import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn("Redis read failed", error);
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T, ttlSeconds?: number): Promise<void> {
  try {
    const payload = JSON.stringify(data);
    if (ttlSeconds && ttlSeconds > 0) {
      await redis.set(key, payload, "EX", ttlSeconds);
    } else {
      await redis.set(key, payload);
    }
  } catch (error) {
    console.warn("Redis write failed", error);
  }
}
