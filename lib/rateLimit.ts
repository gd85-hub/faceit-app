import { ApiError } from "@/lib/errors";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const requestsByIp = new Map<string, RateLimitEntry>();

function requestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const requestWithIp = request as Request & { ip?: string };
  return requestWithIp.ip ?? request.headers.get("x-real-ip") ?? "unknown";
}

function pruneExpired(now: number) {
  for (const [ip, entry] of requestsByIp) {
    if (entry.resetAt <= now) {
      requestsByIp.delete(ip);
    }
  }
}

export function assertCompareRateLimit(request: Request) {
  const now = Date.now();
  const ip = requestIp(request);
  pruneExpired(now);

  const entry = requestsByIp.get(ip);
  if (!entry) {
    requestsByIp.set(ip, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return;
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS) {
    throw new ApiError("RATE_LIMITED");
  }
}

export function clearRateLimitForTests() {
  requestsByIp.clear();
}
