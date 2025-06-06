// cache.js
const redisClient = require('../utils/redisClient'); // Use the name from your file

module.exports = async (req, res, next) => {
    try {
        if (!redisClient.isReady) { // Check if the client is connected and ready
            console.warn('Redis client not ready, skipping cache lookup.');
            return next(); // Proceed without cache if Redis isn't ready
        }

        const cached = await redisClient.get('chapters');
        if (cached) {
            console.log('Serving from Redis cache.');
            return res.json(JSON.parse(cached));
        }
        next();
    } catch (error) {
        // This catches errors *during* `get()`, e.g., if connection drops after `isReady` check
        console.error('Error accessing Redis cache:', error.message);
        next(); // Proceed without cache if there's an error
    }
};