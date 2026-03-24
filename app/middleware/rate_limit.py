"""Redis-backed rate limiting middleware for API protection.

Uses a sliding window counter per IP, stored in Redis.
Falls back to in-memory if Redis is unavailable.
"""

import logging
import os
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

# Per-endpoint tier overrides (path prefix -> requests per minute)
ENDPOINT_TIERS = {
    "/api/coach/message": 30,  # Expensive LLM calls
    "/api/coach/start-onboarding": 10,
    "/api/messages/broadcast": 10,
}


def _get_redis():
    """Lazy Redis connection (singleton)."""
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return None
    try:
        import redis
        return redis.Redis.from_url(redis_url, decode_responses=True, socket_timeout=1)
    except Exception:
        return None


# Module-level lazy singleton
_redis_client = None
_redis_checked = False


def _redis():
    global _redis_client, _redis_checked
    if not _redis_checked:
        _redis_client = _get_redis()
        _redis_checked = True
        if _redis_client:
            try:
                _redis_client.ping()
                logger.info("Rate limiter: using Redis backend")
            except Exception:
                logger.warning("Rate limiter: Redis unavailable, falling back to in-memory")
                _redis_client = None
        else:
            logger.info("Rate limiter: no REDIS_URL, using in-memory backend")
    return _redis_client


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-backed rate limiter with per-endpoint tiers.

    Falls back to in-memory if Redis is unavailable.
    """

    def __init__(self, app, requests_per_minute: int = 300, burst_limit: int = 10):
        super().__init__(app)
        self.default_rpm = requests_per_minute
        self.burst_limit = burst_limit
        # In-memory fallback
        self._windows = defaultdict(list)

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limiting for health checks
        if request.url.path in ("/health",):
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        path = request.url.path

        # Determine rate limit for this endpoint
        rpm = self.default_rpm
        for prefix, tier_rpm in ENDPOINT_TIERS.items():
            if path.startswith(prefix):
                rpm = tier_rpm
                break

        # Try Redis, fallback to in-memory
        r = _redis()
        if r:
            allowed = self._check_redis(r, client_ip, path, rpm)
        else:
            allowed = self._check_memory(client_ip, rpm)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again later."},
                headers={"Retry-After": "60"},
            )

        return await call_next(request)

    def _check_redis(self, r, client_ip: str, path: str, rpm: int) -> bool:
        """Sliding window counter in Redis."""
        # Use a key that includes the tier prefix for per-endpoint limiting
        tier_key = "default"
        for prefix in ENDPOINT_TIERS:
            if path.startswith(prefix):
                tier_key = prefix.replace("/", "_")
                break

        key = f"rl:{client_ip}:{tier_key}"
        now = time.time()
        window_start = now - 60

        try:
            pipe = r.pipeline()
            pipe.zremrangebyscore(key, 0, window_start)
            pipe.zcard(key)
            pipe.zadd(key, {str(now): now})
            pipe.expire(key, 120)
            results = pipe.execute()
            count = results[1]
            return count < rpm
        except Exception:
            # Redis error — allow request (fail open)
            return True

    def _check_memory(self, client_ip: str, rpm: int) -> bool:
        """In-memory fallback sliding window."""
        now = time.time()
        window_start = now - 60

        self._windows[client_ip] = [
            t for t in self._windows[client_ip] if t > window_start
        ]

        if len(self._windows[client_ip]) >= rpm:
            return False

        self._windows[client_ip].append(now)
        return True

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"
