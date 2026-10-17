from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "CrisisLens AI API"
    database_url: str = "sqlite:///./crisislens.db"
    cors_origins: str = "http://localhost:3000,http://localhost:8080"
    responder_api_token: str = ""
    admin_api_token: str = ""
    rate_limit_per_minute: int = 120
    environment: str = "development"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
