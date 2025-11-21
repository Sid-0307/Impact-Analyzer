from pydantic_settings import BaseSettings
from pathlib import Path
import os

class Settings(BaseSettings):
    repos_path: Path = Path("./repos")
    database_url: str = "sqlite:///./impact_analyzer.db"
    gemini_api_key: str
    smtp_email: str
    smtp_password: str
    
    class Config:
        env_file = os.path.join(os.path.dirname(__file__), '..', '.env')

settings = Settings()
