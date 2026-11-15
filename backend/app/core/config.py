from decimal import Decimal
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./data/aether_erp.db"
    secret_key: str = "dev-only-secret-change-me-dev-only-secret"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    cors_origins: str = "http://localhost:5173"
    rate_limit_per_minute: int = 120
    login_rate_limit_per_minute: int = 10
    po_approval_threshold: Decimal = Decimal("50000000")

    @model_validator(mode="after")
    def _require_real_secret(self):
        weak = self.secret_key.startswith("dev-only") or len(self.secret_key) < 32
        if weak and not self.database_url.startswith("sqlite"):
            raise ValueError("SECRET_KEY must be a random string of at least 32 characters when not using SQLite")
        return self

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
