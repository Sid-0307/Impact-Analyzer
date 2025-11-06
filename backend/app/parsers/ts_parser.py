import subprocess
import json
from pathlib import Path
from typing import Dict

class TypeScriptParser:
    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path)
        self.parser_script = Path(__file__).parent.parent.parent / "ts-parser" / "parse.js"
    
    def parse(self) -> Dict:
        """Call Node.js script to parse TypeScript files"""
        try:
            result = subprocess.run(
                ['node', str(self.parser_script), str(self.repo_path)],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                print(f"TypeScript parser error: {result.stderr}")
                return {"nodes": [], "edges": [], "http_calls": []}
        
        except Exception as e:
            print(f"Error running TypeScript parser: {e}")
            return {"nodes": [], "edges": [], "http_calls": []}