class DomainError(Exception):
    """Business-rule violation. Mapped to HTTP 422/409/404 by the API layer."""

    status_code = 422

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class NotFound(DomainError):
    status_code = 404


class Conflict(DomainError):
    status_code = 409


class Forbidden(DomainError):
    status_code = 403
