from pydantic_settings import BaseSettings
from pathlib import Path
import os

class Settings(BaseSettings):
    github_token: str
    repos_path: Path = Path("./repos")
    database_url: str = "sqlite:///./impact_analyzer.db"
    
    class Config:
        env_file = os.path.join(os.path.dirname(__file__), '..', '.env')

settings = Settings()