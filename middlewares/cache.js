// cache.js

// Import the initialized @upstash/redis client from your utility file
const redis = require('../utils/redisClient');

/**
 * Cache middleware for the /api/v1/chapters endpoint.
 * Attempts to retrieve data from Redis cache. If data is found, it's returned.
 * Otherwise, the request proceeds to the next middleware/route handler.
 *
 * This middleware uses the @upstash/redis client, which operates via HTTP requests.
 * Therefore, traditional Redis client `isReady` checks are not applicable.
 * The `try...catch` block handles potential errors during the Redis `get` operation.
 */
module.exports = async (req, res, next) => {
    try {
        // Attempt to fetch data from Redis cache.
        // The @upstash/redis client handles network and API errors internally,
        // but the try/catch here provides an outer layer for logging and fallback.
        const cached = await redis.get('chapters');

        if (cached) {
            console.log('Serving /api/v1/chapters from Redis cache.');
            // Parse the cached JSON string back into a JavaScript object and send as response.
            return res.json(JSON.parse(cached));
        }

        // If no data is found in cache, proceed to the next middleware/route handler.
        next();
    } catch (error) {
        // Log any errors encountered during Redis cache access.
        // This could be due to network issues, Upstash API errors, or invalid responses.
        console.error('Error accessing Redis cache (Upstash):', error.message);
        // Important: Do not block the request. Proceed to the next middleware/route handler
        // so the application can still serve the request by fetching from MongoDB.
        next();
    }
};
