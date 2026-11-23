import os
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application Settings loaded from environment variables and .env file.
    Follows 12-factor app principles.
    """
    PROJECT_NAME: str = "Bugveil"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "127.0.0.1"

    # CORS configuration
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./bugveil.db"

    # Groq AI Provider
    GROQ_API_KEY: str = Field(default="your_groq_api_key_here")
    GROQ_MODEL: str = Field(default="llama-3.3-70b-versatile")
    GROQ_API_BASE_URL: str = Field(default="https://api.groq.com/openai/v1")
    GROQ_TIMEOUT_SECONDS: int = 45
    GROQ_MAX_RETRIES: int = 3
    ALLOW_MOCK_FALLBACK: bool = True

    # Safe Local Storage
    STORAGE_DIR: str = "./data/storage"
    MAX_UPLOAD_SIZE_MB: int = 50
    MAX_UNCOMPRESSED_SIZE_MB: int = 150
    MAX_FILE_COUNT: int = 2500

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_groq_configured(self) -> bool:
        """
        Check if a real Groq API key is configured (not empty and not the placeholder).
        """
        key = self.GROQ_API_KEY.strip()
        return bool(key and key != "your_groq_api_key_here" and len(key) > 10)

    @property
    def absolute_storage_dir(self) -> str:
        """
        Resolves the absolute storage directory and ensures it exists.
        """
        backend_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        if os.path.isabs(self.STORAGE_DIR):
            path = self.STORAGE_DIR
        else:
            path = os.path.join(backend_root, self.STORAGE_DIR)
        os.makedirs(path, exist_ok=True)
        return os.path.abspath(path)


settings = Settings()
