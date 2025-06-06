// utils/redisClient.js

// Import the Redis class from the @upstash/redis library.
// This library provides a client for interacting with Upstash Redis via its REST API.
import { Redis } from '@upstash/redis';

/**
 * Initializes the Upstash Redis client.
 *
 * This client connects to Upstash Redis using its REST API, which means
 * it uses HTTP requests instead of a persistent TCP connection.
 * As a result, traditional Redis client event listeners (like 'connect', 'error', 'ready')
 * are not applicable here. Connection and retry logic are handled internally by
 * the @upstash/redis library for each HTTP request.
 *
 * Environment variables for the URL and Token MUST be set for this to work:
 * - UPSTASH_REDIS_REST_URL: The REST API URL provided by Upstash.
 * - UPSTASH_REDIS_REST_TOKEN: The REST API token provided by Upstash.
 */
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Exports the initialized Upstash Redis client instance.
 * Other modules can now import and use this 'redisClient' object
 * to perform Redis operations (e.g., get, set, incr).
 */
module.exports = redisClient;
