import { redis } from "@/lib/redis";

/**
 * Rate limit simple
 * - key: ip
 * - window: 1 heure
 * - limit: RATE_LIMIT_PER_HOUR
 *
 * Retourne allowed + remaining + resetSeconds
 */
export async function rateLimitHourly(ip: string) {
  const limit = parseInt(process.env.RATE_LIMIT_PER_HOUR || "60", 10);
  const windowSeconds = 60 * 60;

  const now = Math.floor(Date.now() / 1000);
  const windowId = Math.floor(now / windowSeconds);
  const key = `rl:hour:${windowId}:${ip || "unknown"}`;

  // INCR + TTL
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds + 5);
  }

  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);

  const resetAt = (windowId + 1) * windowSeconds;
  const resetSeconds = Math.max(0, resetAt - now);

  return { allowed, remaining, resetSeconds, limit, count };
}
