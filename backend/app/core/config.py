"""Application settings loaded from environment."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "Digital Math Teacher API"
    debug: bool = False

    # API
    api_v1_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/digital_math_teacher"

    # Auth
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str | None = None
    frontend_base_url: str = "http://localhost:3000"
    oauth_state_ttl_minutes: int = 10
    oauth_login_code_ttl_minutes: int = 5
    guest_idle_ttl_hours: int = 24
    guest_hard_delete_days: int = 7
    enable_scheduler: bool = True

    # Optional: Supabase (if using Supabase Auth instead of custom JWT)
    supabase_url: str | None = None
    supabase_anon_key: str | None = None

    # LLM (for analysis and chat)
    openai_api_key: str | None = None

    # Storage (for snapshot images)
    storage_bucket: str | None = None


settings = Settings()
