import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const ipRequestMap = new Map<
  string,
  { count: number; windowStart: number }
>();

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

export function proxy(request: NextRequest) {
  const ip = getClientIp(request);
  const now = Date.now();
  const record = ipRequestMap.get(ip);

  if (!record || now - record.windowStart > WINDOW_MS) {
    ipRequestMap.set(ip, { count: 1, windowStart: now });
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
    response.headers.set("X-RateLimit-Remaining", String(MAX_REQUESTS - 1));
    return response;
  }

  record.count++;

  if (record.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil(
      (record.windowStart + WINDOW_MS - now) / 1000
    );
    return NextResponse.json(
      { error: "Too many requests", retryAfterSeconds: retryAfter },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
  response.headers.set(
    "X-RateLimit-Remaining",
    String(MAX_REQUESTS - record.count)
  );
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
