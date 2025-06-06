// utils/redisClient.js

// Declare a variable for the redis client
let redisClient;

/**
 * Asynchronously initializes the Upstash Redis client.
 * This function uses dynamic import to load the @upstash/redis library,
 * allowing this file to remain a CommonJS module while using an ESM library.
 * The client connects to Upstash Redis via its REST API, which means
 * it uses HTTP requests. Connection and retry logic are handled internally
 * by the @upstash/redis library.
 */
async function initializeRedisClient() {
  try {
    // Dynamically import the Redis class from @upstash/redis.
    // This allows the file to use CommonJS 'module.exports' syntax.
    const { Redis } = await import('@upstash/redis');

    /**
     * Initialize the Redis client using environment variables.
     * UPSTASH_REDIS_REST_URL: The REST API URL from Upstash.
     * UPSTASH_REDIS_REST_TOKEN: The REST API token from Upstash.
     */
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    console.log('Upstash Redis client initialized.');

    // Optional: Test a simple operation to confirm connectivity
    // This will log 'PONG' if successful.
    // try {
    //   await redisClient.set('health_check', 'pong');
    //   const test = await redisClient.get('health_check');
    //   console.log(`Redis health check: ${test}`);
    // } catch (testError) {
    //   console.error('Upstash Redis health check failed:', testError.message);
    // }

  } catch (error) {
    // Log any errors during the initialization of the Redis client itself.
    console.error('Error initializing Upstash Redis client:', error.message);
    redisClient = null; // Set to null if initialization fails
  }
}

// Call the initialization function immediately when the module is required.
// We don't 'await' it here to prevent blocking the main thread during module load.
initializeRedisClient();

/**
 * Exports a getter for the redisClient instance.
 * This allows other modules to access the client after it has been initialized.
 * Callers should check if the client is not null before using it.
 */
module.exports = {
  get client() {
    return redisClient;
  },
  // Optionally, you could export initializeRedisClient if you wanted to explicitly
  // await its completion in server.js before starting the app (not strictly necessary for this use case).
};
