from git import Repo
from pathlib import Path
from config import settings
import shutil

def clone_or_pull_repo(repo_url: str) -> Path:
    """Clone repo or pull if already exists"""
    repo_name = repo_url.split('/')[-1].replace('.git', '')
    repo_path = settings.repos_path / repo_name
    
    if repo_path.exists():
        # Pull latest changes
        repo = Repo(repo_path)
        repo.remotes.origin.pull()
    else:
        # Clone
        settings.repos_path.mkdir(parents=True, exist_ok=True)
        Repo.clone_from(repo_url, repo_path)
    
    return repo_path

def extract_repo_full_name(repo_url: str) -> str:
    """Extract owner/repo from GitHub URL"""
    # https://github.com/owner/repo -> owner/repo
    parts = repo_url.rstrip('/').split('/')
    return f"{parts[-2]}/{parts[-1].replace('.git', '')}"

def cleanup_repo(repo_path: Path):
    """Delete cloned repo"""
    if repo_path.exists():
        shutil.rmtree(repo_path)