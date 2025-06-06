// cache.js

// Import the object exported by utils/redisClient.js
const redisClientWrapper = require('../utils/redisClient');

/**
 * Cache middleware for the /api/v1/chapters endpoint.
 * Attempts to retrieve data from Redis cache. If data is found, it's returned.
 * Otherwise, the request proceeds to the next middleware/route handler.
 *
 * This middleware uses the @upstash/redis client, which operates via HTTP requests.
 * It checks if the client is available before attempting to use it.
 */
module.exports = async (req, res, next) => {
    const redisClient = redisClientWrapper.client; // Access the client instance via the getter

    try {
        // Ensure client exists before attempting to use it.
        // @upstash/redis doesn't have an `isReady` property for persistent connection status,
        // so we primarily check if the client object was successfully initialized.
        if (!redisClient) {
            console.warn('Upstash Redis client not available for cache lookup, skipping cache.');
            return next(); // Proceed without cache if Redis client is not initialized
        }

        // Attempt to fetch data from Redis cache.
        // The @upstash/redis client handles network and API errors internally for each request,
        // but the try/catch here provides an outer layer for logging and fallback.
        const cached = await redisClient.get('chapters');

        if (cached) {
            console.log('Serving /api/v1/chapters from Redis cache.');
            // Parse the cached JSON string back into a JavaScript object and send as response.
            return res.json(JSON.parse(cached));
        }

        // If no data is found in cache, proceed to the next middleware/route handler.
        next();
    } catch (error) {
        // Log any errors encountered during Redis cache access.
        console.error('Error accessing Redis cache (Upstash):', error.message);
        // Important: Do not block the request. Proceed to the next middleware/route handler
        // so the application can still serve the request by fetching from MongoDB.
        next();
    }
};
