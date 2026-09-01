import Redis, { RedisOptions } from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var redisClientInstance: Redis | undefined;
}

let isHealthy = false;

function createRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS || process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn('[Redis] No REDIS or REDIS_URL environment variable configured. In-memory fallback will be used.');
    isHealthy = false;
    return null;
  }

  try {
    const options: RedisOptions = {
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 1500,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 10) {
          console.warn('[Redis] Max reconnect retries reached, backing off.');
          return 5000;
        }
        return Math.min(times * 200, 2000);
      },
    };

    const client = new Redis(redisUrl, options);

    client.on('connect', () => {
      // Socket connected
    });

    client.on('ready', () => {
      isHealthy = true;
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Redis] Connected and ready.');
      }
    });

    client.on('error', (err) => {
      isHealthy = false;
      console.warn('[Redis] Connection error:', err.message);
    });

    client.on('close', () => {
      isHealthy = false;
    });

    client.on('reconnecting', () => {
      isHealthy = false;
    });

    client.on('end', () => {
      isHealthy = false;
    });

    return client;
  } catch (error) {
    console.error('[Redis] Failed to initialize client:', error);
    isHealthy = false;
    return null;
  }
}

let client: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (process.env.NODE_ENV === 'production') {
    if (!client) {
      client = createRedisClient();
    }
    return client;
  }

  // Development / Test: use globalThis to preserve connection across HMR
  if (!global.redisClientInstance) {
    global.redisClientInstance = createRedisClient() ?? undefined;
  }
  return global.redisClientInstance ?? null;
}

export function isRedisHealthy(): boolean {
  return isHealthy;
}

export async function closeRedisConnection(): Promise<void> {
  const currentClient = process.env.NODE_ENV === 'production' ? client : global.redisClientInstance;
  if (currentClient) {
    try {
      await currentClient.quit();
    } catch {
      currentClient.disconnect();
    }
    client = null;
    global.redisClientInstance = undefined;
    isHealthy = false;
  }
}
