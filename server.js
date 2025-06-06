// server.js

// Core Node.js and Express imports
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

// Environment variable configuration - should be loaded as early as possible
require('dotenv').config();

// Custom module imports
const chapterRoutes = require('./routes/chapterRoutes');
// Import the initialized @upstash/redis client from your utility file
const redis = require('./utils/redisClient');

// Initialize the Express application
const app = express();

// Middleware for CORS and JSON body parsing
app.use(cors());
app.use(express.json());

/**
 * MongoDB Connection
 * Establishes a connection to the MongoDB database using Mongoose.
 * Logs success or error and exits the process if the connection fails,
 * as the database is a critical dependency for the application.
 *
 * Deprecated Mongoose options (like useNewUrlParser, useUnifiedTopology) are removed
 * as they have no effect in Mongoose v6+ and produce warning logs.
 */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message); // Log only the message for cleaner output
    process.exit(1); // Exit if MongoDB connection fails - critical dependency
  });

/**
 * Start the Express Server
 * The server is started independently of Redis connection status to ensure
 * the API is always accessible. This prevents a "502 Bad Gateway" error
 * if Redis is temporarily unavailable or slow to connect.
 */
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

/**
 * Setup Rate Limiting with Redis (or In-Memory Fallback)
 * This asynchronous IIFE (Immediately Invoked Function Expression)
 * configures rate limiting. It attempts to use Redis for rate limiting
 * if the Redis client is available and compatible with `rate-limit-redis`.
 * If not, it gracefully falls back to an in-memory store.
 *
 * Note on @upstash/redis compatibility with rate-limit-redis:
 * `rate-limit-redis` often relies on low-level Redis commands, including
 * Lua scripts, which are not directly exposed or supported by @upstash/redis's
 * REST API based `sendCommand` method in the same way a direct TCP client does.
 * This section includes logic to handle this potential incompatibility.
 */
(async () => {
  // Dynamically import rate-limiting libraries
  const rateLimit = require('express-rate-limit');
  const { default: RedisStore } = await import('rate-limit-redis');

  let limiter; // Variable to hold the configured rate limiter instance

  try {
    /**
     * Attempt to create a Redis-backed store for rate limiting.
     * This part is specific to `rate-limit-redis` and its `sendCommand` expectation.
     * The `sendCommand` function must translate `rate-limit-redis`'s commands
     * (like 'incr', 'expire', potentially 'evalsha' for Lua scripts)
     * into operations compatible with the @upstash/redis client.
     * If @upstash/redis does not expose these in a compatible way,
     * this will likely fail and trigger the catch block.
     */
    limiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute window for rate limiting
      max: 30, // Max 30 requests per IP per window
      standardHeaders: true, // Add rate limit info to response headers
      legacyHeaders: false, // Disable X-RateLimit-*-Headers
      store: new RedisStore({
        // The sendCommand function for @upstash/redis needs careful implementation.
        // @upstash/redis exposes direct methods (e.g., `redis.incr`, `redis.expire`).
        // `rate-limit-redis` expects a low-level `sendCommand` that works with any command.
        // This is a common point of incompatibility with REST-based Redis clients.
        sendCommand: async (command, ...args) => {
          // This is a simplified example; a full implementation would need
          // to map all commands used by `rate-limit-redis` (like 'incr', 'expire', 'evalsha').
          // If `rate-limit-redis` uses Lua scripts (via EVAL or EVALSHA),
          // @upstash/redis does not directly support them, leading to failure here.
          switch (command.toLowerCase()) {
            case 'incr':
              return await redis.incr(args[0]); // Upstash client's direct incr method
            case 'expire':
              return await redis.expire(args[0], args[1]); // Upstash client's direct expire method
            // Add more cases for other commands `rate-limit-redis` might use (e.g., GET, SET, PTTL)
            default:
              console.warn(`[Rate Limiter] Unhandled command for Upstash RedisStore: ${command}`);
              throw new Error(`Command '${command}' not directly supported by Upstash Redis client for RateLimitingStore.`);
          }
        },
      }),
    });
    console.log('Redis-based rate limiter initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Redis-based rate limiter (potentially due to Upstash compatibility):', error.message);
    // If RedisStore initialization fails, fall back to the default in-memory store.
    limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
    });
    console.warn('Falling back to in-memory rate limiter for resilience.');
  }

  // Apply the chosen rate limiter middleware to all incoming requests
  app.use(limiter);

  // Define API routes after rate limiting is applied
  app.use('/api/v1/chapters', chapterRoutes);

  /**
   * Basic Health Check Route
   * Provides a simple endpoint to verify the server is running and responsive.
   */
  app.get('/', (req, res) => {
    res.status(200).json({ message: 'Mathongo Backend API is running!' });
  });

})(); // End of async IIFE for rate limit setup
