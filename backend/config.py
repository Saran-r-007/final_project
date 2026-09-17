"""
Application configuration loaded from environment variables.
All secrets stay server-side only — never exposed to frontend or logs.
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env from this directory
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path)

BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    # AI keys — server-only
    gemini_api_key: str = ""
    assemblyai_api_key: str = ""

    # Notifications — global defaults
    notification_phone: str = "+919597389141"
    notification_email: str = "saran2007r@gmail.com"
    notification_mode: str = "LIVE"

    # Twilio (optional, for real SMS/Call)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_api_key_sid: str = ""
    twilio_from_number: str = ""

    # SMTP (optional, for real email)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_address: str = ""

    # Storage
    upload_dir: str = "uploads"
    separated_dir: str = "separated"
    max_file_size_mb: int = 25
    max_recording_seconds: int = 300

    # Derived paths (set in __init__)
    upload_path: Path = Path("uploads")
    separated_path: Path = Path("separated")
    db_path: Path = Path("audio_intelligence.db")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def model_post_init(self, __context):
        self.upload_path = BASE_DIR / self.upload_dir
        self.separated_path = BASE_DIR / self.separated_dir
        self.db_path = BASE_DIR / "audio_intelligence.db"
        self.upload_path.mkdir(parents=True, exist_ok=True)
        self.separated_path.mkdir(parents=True, exist_ok=True)


settings = Settings()
