// server.js
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Ensure this is at the very top to load env vars

const chapterRoutes = require('./routes/chapterRoutes');
const redisClient = require('./utils/redisClient'); // Your improved Redis client

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  // These options are deprecated in newer Mongoose versions (v6+).
  // You can safely remove them to clean up warnings if you're using a recent Mongoose.
  // useNewUrlParser: true,
  // useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully!')) // More descriptive log
.catch(err => {
  console.error('MongoDB connection error:', err); // Better error message
  process.exit(1); // Stop app if DB fails (essential for critical dependency)
});

// --- Start the Express Server independently ---
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// --- Setup Redis-based Rate Limiting (Conditionally) ---
// This async IIFE will run after the server starts listening,
// and it will only apply the Redis limiter if Redis is ready.
(async () => {
  const rateLimit = require('express-rate-limit');
  const { default: RedisStore } = await import('rate-limit-redis'); // Await import is fine here

  let limiter;

  // Check if Redis is ready before attempting to use RedisStore
  // The `isReady` property on the client object is crucial for this check.
  if (redisClient.isReady) {
    try {
      limiter = rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 30, // limit each IP to 30 requests per minute
        standardHeaders: true,
        legacyHeaders: false,
        store: new RedisStore({
          // The sendCommand function should typically expect individual args, not an array
          // check the `rate-limit-redis` documentation. This is often the correct way:
          sendCommand: (...args) => redisClient.sendCommand(args),
          // Or if your client method needs to be called like: `client.get('key')`
          // sendCommand: (command, ...args) => redisClient[command](...args), // Less common but possible
        }),
      });
      console.log('Redis-based rate limiter initialized.');
    } catch (error) {
      console.error('Failed to initialize Redis-based rate limiter:', error.message);
      // Fallback to in-memory store if RedisStore initialization fails
      limiter = rateLimit({
        windowMs: 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
        // No store option means it uses the default MemoryStore
      });
      console.warn('Falling back to in-memory rate limiter.');
    }
  } else {
    // If Redis is not ready on startup, use a simple in-memory limiter
    limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      // No store option means it uses the default MemoryStore
    });
    console.warn('Redis client not ready on startup, using in-memory rate limiter.');
  }

  // Apply the chosen limiter (either Redis-based or in-memory)
  app.use(limiter);

  // Your API routes
  app.use('/api/v1/chapters', chapterRoutes);

  // Add a basic route for health check (optional but good practice)
  app.get('/', (req, res) => {
    res.status(200).json({ message: 'Mathongo Backend API is running!' });
  });

})(); // End of the async IIFE