import time
from collections import defaultdict, deque
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import get_settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    """In-process sliding-window limiter keyed by client IP. Use a shared store (Redis) behind multiple workers."""

    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _allow(self, key: str, limit: int) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True

    async def dispatch(self, request, call_next):
        s = get_settings()
        ip = request.client.host if request.client else "unknown"
        is_login = request.url.path.endswith("/auth/login")
        limit = s.login_rate_limit_per_minute if is_login else s.rate_limit_per_minute
        key = f"{ip}:{'login' if is_login else 'api'}"
        if not self._allow(key, limit):
            return JSONResponse({"detail": "Too many requests"}, status_code=429, headers={"Retry-After": "60"})
        return await call_next(request)
