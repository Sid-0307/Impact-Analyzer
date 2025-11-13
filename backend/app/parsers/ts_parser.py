import subprocess
import json
from pathlib import Path
from typing import Dict

class TypeScriptParser:
    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path)
        # Updated to point to script.js
        self.parser_script = Path(__file__).parent.parent.parent / "ts-parser" / "script.js"
    
    def parse(self) -> Dict:
        """Call Node.js script to parse TypeScript files and convert to dependency graph format"""
        try:
            # Change working directory to repo path so script.js can find frontend-test/src
            result = subprocess.run(
                ['node', str(self.parser_script)],
                capture_output=True,
                text=True,
                encoding='utf-8',  # Force UTF-8 encoding to avoid Windows cp1252 issues
                errors='replace',  # Replace invalid characters instead of crashing
                timeout=120,  # Increased timeout as script.js is more comprehensive
                cwd=str(self.repo_path)  # Run from repo directory
            )
            
            if result.returncode == 0:
                # script.js writes to outputs/frontend_graph.json (sibling to repos/)
                # If repo_path is repos/frontend-test, go up 2 levels and add outputs
                output_file = self.repo_path.parent.parent / "outputs" / "frontend_graph.json"
                if output_file.exists():
                    with open(output_file, 'r', encoding='utf-8') as f:
                        api_data = json.load(f)
                    
                    # Convert script.js format to parse.js format
                    return self._convert_to_graph_format(api_data)
                else:
                    print(f"Output file not found: {output_file}")
                    return {"nodes": [], "edges": [], "http_calls": []}
            else:
                print(f"TypeScript parser error: {result.stderr}")
                return {"nodes": [], "edges": [], "http_calls": []}
        
        except subprocess.TimeoutExpired:
            print("TypeScript parser timed out")
            return {"nodes": [], "edges": [], "http_calls": []}
        except Exception as e:
            print(f"Error running TypeScript parser: {e}")
            return {"nodes": [], "edges": [], "http_calls": []}
    
    def _convert_to_graph_format(self, api_data: list) -> Dict:
        """Convert script.js output format to parse.js dependency graph format"""
        nodes = []
        edges = []
        http_calls = []
        
        # Track unique nodes and classes
        seen_nodes = set()
        
        for item in api_data:
            class_name = item.get("class", "UnknownClass")
            function_name = item.get("function", "")
            file_path = item.get("file", "")
            
            # Extract method name from "ClassName.methodName"
            if "." in function_name:
                method_name = function_name.split(".")[-1]
            else:
                method_name = function_name
            
            method_id = f"{class_name}.{method_name}"
            
            # Add node if not already added
            if method_id not in seen_nodes:
                # Determine node type based on decorators
                decorators = item.get("decorators", [])
                is_service = any("Injectable" in d for d in decorators) or class_name.endswith("Service")
                is_component = any("Component" in d for d in decorators) or class_name.endswith("Component")
                
                # Extract injected services from properties
                injected_services = []
                for prop in item.get("properties", []):
                    prop_type = prop.get("type", "")
                    # Common service patterns
                    if "Service" in prop_type or "HttpClient" in prop_type:
                        injected_services.append({
                            "name": prop.get("name", ""),
                            "type": prop_type
                        })
                
                nodes.append({
                    "id": method_id,
                    "type": "angular_service" if is_service else "angular_component" if is_component else "angular_class",
                    "file": file_path,
                    "class": class_name,
                    "injected_services": injected_services,
                    "access": item.get("access", "public"),
                    "returnType": item.get("returnType", "void"),
                    "parameters": item.get("parameterDetails", []),
                    "doc": item.get("doc", "")
                })
                seen_nodes.add(method_id)
            
            # Add HTTP call
            method = item.get("method", "GET")
            url = item.get("url", "")
            
            if url:
                http_calls.append({
                    "source": method_id,
                    "url": url,
                    "method": method.upper() if method else "GET",
                    "file": file_path,
                    "type": self._detect_http_client_type(item),
                    "params": item.get("params"),
                    "body": item.get("body"),
                    "location": item.get("location", {})
                })
        
        return {
            "nodes": nodes,
            "edges": edges,
            "http_calls": http_calls
        }
    
    def _detect_http_client_type(self, item: dict) -> str:
        """Detect which HTTP client is being used"""
        # Could be enhanced by checking the actual call expression
        # For now, infer from common patterns
        if "HttpClient" in str(item.get("properties", [])):
            return "HttpClient"
        elif "axios" in item.get("function", "").lower():
            return "axios"
        else:
            return "fetch"