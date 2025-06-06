// utils/redisClient.js
const redis = require('redis');

const client = redis.createClient({
    url: process.env.REDIS_URL,
    // Add these options for better resilience, though modern clients have good defaults
    // If you face timeouts, consider:
    // socket: {
    //     connectTimeout: 10000, // 10 seconds for initial connection
    //     // KeepAlive is often handled by default, but can be explicit
    // }
});

// 1. Handle connection errors more explicitly
client.on('error', err => {
    console.error('Redis Client Error:', err.message);
    // Important: Do NOT add process.exit(1) here if you want your app to survive
    // without Redis being constantly available. The client library is designed
    // to attempt re-connections automatically.
});

// 2. Log connection status (useful for debugging deployments)
client.on('connect', () => {
    console.log('Redis client: Attempting to connect...');
});

client.on('ready', () => {
    console.log('Redis client: Successfully connected and ready to use!');
});

client.on('end', () => {
    console.log('Redis client: Connection closed.');
});

client.on('reconnecting', () => {
    console.log('Redis client: Reconnecting...');
});

// 3. Initiate the connection.
//    By putting it here, it connects when the module is imported.
//    The .catch() is good for the *initial* connection failure.
client.connect().catch(err => {
    console.error('Redis initial connection failed:', err.message);
    // If Redis is absolutely critical for your app to start, you could
    // consider process.exit(1) here, but for caching, it's usually not.
});

module.exports = client;