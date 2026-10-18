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
    cors_origins: str = "http://localhost:3000,http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173"
    responder_api_token: str = "dev-responder-token"
    admin_api_token: str = "dev-admin-token"
    rate_limit_per_minute: int = 120
    environment: str = "development"

    # Live external geocoding providers
    geocoding_provider: str = "nominatim"  # "nominatim", "mapbox", "google", or "local"
    mapbox_api_key: str = ""
    google_maps_api_key: str = ""
    geocoding_timeout_seconds: float = 4.0

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
