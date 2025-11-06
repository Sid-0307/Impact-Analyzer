from github import Github
from config import settings
from typing import Dict, List

class GitHubService:
    def __init__(self):
        self.client = Github(settings.github_token)
    
    def get_pr_diff(self, repo_full_name: str, pr_number: int) -> List[str]:
        """Get list of changed files in a PR"""
        try:
            repo = self.client.get_repo(repo_full_name)
            pr = repo.get_pull(pr_number)
            
            changed_files = []
            for file in pr.get_files():
                changed_files.append({
                    "filename": file.filename,
                    "status": file.status,  # added, modified, removed
                    "patch": file.patch  # Actual diff
                })
            
            return changed_files
        
        except Exception as e:
            print(f"Error fetching PR diff: {e}")
            return []
    
    def post_comment(self, repo_full_name: str, pr_number: int, comment: str) -> str:
        """Post a comment to a PR"""
        try:
            repo = self.client.get_repo(repo_full_name)
            pr = repo.get_pull(pr_number)
            comment_obj = pr.create_issue_comment(comment)
            
            return comment_obj.html_url
        
        except Exception as e:
            print(f"Error posting comment: {e}")
            return None
    
    def create_webhook(self, repo_full_name: str, webhook_url: str) -> str:
        """Create a webhook for PR events"""
        try:
            repo = self.client.get_repo(repo_full_name)
            
            config = {
                "url": webhook_url,
                "content_type": "json"
            }
            
            hook = repo.create_hook(
                name="web",
                config=config,
                events=["pull_request"],
                active=True
            )
            
            return str(hook.id)
        
        except Exception as e:
            print(f"Error creating webhook: {e}")
            return None