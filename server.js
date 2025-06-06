// server.js

// Core Node.js and Express imports
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

// Environment variable configuration - should be loaded as early as possible
require('dotenv').config();

// Custom module imports
const chapterRoutes = require('./routes/chapterRoutes');
// Import the object exported by utils/redisClient.js.
// We now access the client instance via 'redisClientWrapper.client'.
const redisClientWrapper = require('./utils/redisClient');

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
 */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
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
  const currentRedisClient = redisClientWrapper.client; // Access the client via the getter

  try {
    /**
     * Attempt to create a Redis-backed store for rate limiting.
     * This part is specific to `rate-limit-redis` and its `sendCommand` expectation.
     *
     * IMPORTANT: The `@upstash/redis` client is a REST client. It does not
     * support arbitrary `sendCommand` calls or Lua scripting in the same way
     * a direct TCP Redis client does. This is a common point of incompatibility.
     * `rate-limit-redis` uses specific commands like `incr` and `expire`,
     * and potentially `evalsha` for atomic operations.
     *
     * If this `sendCommand` mapping is insufficient for `rate-limit-redis`'s
     * internal logic, this `try` block will still fail, and it will fall back
     * to the in-memory store.
     */
    if (currentRedisClient) { // Only attempt if the Upstash client was successfully initialized
      limiter = rateLimit({
        windowMs: 60 * 1000, // 1 minute window for rate limiting
        max: 30, // Max 30 requests per IP per window
        standardHeaders: true, // Add rate limit info to response headers
        legacyHeaders: false, // Disable X-RateLimit-*-Headers
        store: new RedisStore({
          sendCommand: async (command, ...args) => {
            const lowerCommand = command.toLowerCase();
            switch (lowerCommand) {
              case 'incr':
                return await currentRedisClient.incr(args[0]);
              case 'expire':
                return await currentRedisClient.expire(args[0], args[1]);
              case 'get': // Some Redis stores might use get
                return await currentRedisClient.get(args[0]);
              case 'set': // Some Redis stores might use set
                  return await currentRedisClient.set(args[0], args[1]);
              case 'evalsha': // `rate-limit-redis` often uses this for atomic operations
              case 'eval': // Alternative for Lua scripts
                console.warn(`[Rate Limiter] Upstash Redis client does not support Lua scripting (EVAL/EVALSHA) directly. Falling back to in-memory store for rate limiting.`);
                // Throw an error here to trigger the catch block and use the in-memory store.
                throw new Error(`Lua scripting not supported by Upstash for rate limiting store.`);
              default:
                console.warn(`[Rate Limiter] Unhandled Redis command for Upstash RedisStore: ${command}. Falling back to in-memory store.`);
                throw new Error(`Unhandled Redis command '${command}' for Upstash RedisStore.`);
            }
          },
        }),
      });
      console.log('Redis-based rate limiter initialized successfully.');
    } else {
      // If Upstash client itself failed to initialize
      console.warn('Upstash Redis client not available for rate limiting. Using in-memory rate limiter.');
      limiter = rateLimit({
        windowMs: 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
      });
    }
  } catch (error) {
    console.error('Failed to initialize Redis-based rate limiter:', error.message);
    // Fall back to the default in-memory store if RedisStore initialization fails
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
