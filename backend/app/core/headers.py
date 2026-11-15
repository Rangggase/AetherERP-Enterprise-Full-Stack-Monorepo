from starlette.middleware.base import BaseHTTPMiddleware

HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        for k, v in HEADERS.items():
            # Swagger UI assets may be cached; API responses must not be.
            if k == "Cache-Control" and request.url.path.startswith("/api/docs"):
                continue
            response.headers.setdefault(k, v)
        return response
