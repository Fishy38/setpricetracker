const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 5;

type Entry = { count: number; last: number };
const rateLimitMap = new Map<string, Entry>();

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) ?? { count: 0, last: now };

  if (now - entry.last > RATE_LIMIT_WINDOW) {
    entry.count = 1;
    entry.last = now;
  } else {
    entry.count += 1;
  }

  rateLimitMap.set(ip, entry);

  const allowed = entry.count <= MAX_REQUESTS;
  const retryAfter = RATE_LIMIT_WINDOW - (now - entry.last);

  // 📊 Logging every call for visibility (optional - you can remove this if spammy)
  console.log("[RATE_LIMIT_CHECK]", {
    ip,
    count: entry.count,
    allowed,
    retryAfter,
    time: new Date().toISOString(),
  });

  return { allowed, retryAfter };
}