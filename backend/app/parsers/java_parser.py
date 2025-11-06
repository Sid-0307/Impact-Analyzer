import javalang
import os
import re
from pathlib import Path
from typing import Dict, List

class JavaParser:
    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path)
        self.graph = {"nodes": [], "edges": [], "endpoints": []}
    
    def parse(self) -> Dict:
        """Parse all Java files and build dependency graph"""
        java_files = list(self.repo_path.rglob("*.java"))
        
        for file_path in java_files:
            if "test" in str(file_path).lower():
                self._parse_test_file(file_path)
            else:
                self._parse_source_file(file_path)
        
        return self.graph
    
    def _parse_source_file(self, file_path: Path):
        """Parse controllers and services"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            tree = javalang.parse.parse(content)
            
            for path, node in tree.filter(javalang.tree.ClassDeclaration):
                class_name = node.name
                
                # Check if it's a controller
                is_controller = any(
                    anno.name in ['RestController', 'Controller'] 
                    for anno in (node.annotations or [])
                )
                
                # Check if it's a service
                is_service = any(
                    anno.name == 'Service' 
                    for anno in (node.annotations or [])
                )
                
                for method in node.methods:
                    method_id = f"{class_name}.{method.name}"
                    
                    if is_controller:
                        self._parse_controller_method(method_id, method, file_path, content)
                    elif is_service:
                        self._parse_service_method(method_id, method, file_path)
        
        except Exception as e:
            print(f"Error parsing {file_path}: {e}")
    
    def _parse_controller_method(self, method_id: str, method, file_path: Path, content: str):
        """Extract endpoint mappings from controller methods"""
        endpoint_info = None
        
        for anno in (method.annotations or []):
            if anno.name in ['GetMapping', 'PostMapping', 'PutMapping', 'DeleteMapping', 'RequestMapping']:
                http_method = anno.name.replace('Mapping', '').upper()
                if http_method == 'REQUEST':
                    http_method = 'GET'  # Default
                
                # Extract path from annotation
                path = self._extract_path_from_annotation(anno)
                
                if path:
                    endpoint_info = {
                        "path": path,
                        "method": http_method,
                        "handler": method_id
                    }
                    
                    self.graph["endpoints"].append(endpoint_info)
                    break
        
        # Add controller method node
        self.graph["nodes"].append({
            "id": method_id,
            "type": "controller",
            "file": str(file_path.relative_to(self.repo_path)),
            "endpoint": endpoint_info
        })
        
        # Find service calls in method body
        self._extract_method_calls(method_id, method, content)
    
    def _parse_service_method(self, method_id: str, method, file_path: Path):
        """Add service method node"""
        self.graph["nodes"].append({
            "id": method_id,
            "type": "service",
            "file": str(file_path.relative_to(self.repo_path))
        })
    
    def _parse_test_file(self, file_path: Path):
        """Parse test files and link to source methods"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            tree = javalang.parse.parse(content)
            
            for path, node in tree.filter(javalang.tree.MethodDeclaration):
                # Look for @Test annotation
                if any(anno.name == 'Test' for anno in (node.annotations or [])):
                    test_name = node.name
                    
                    # Heuristic: match test method name to source method
                    # e.g., testFindUser -> findUser
                    tested_method = self._infer_tested_method(test_name, content)
                    
                    if tested_method:
                        self.graph["edges"].append({
                            "from": f"Test.{test_name}",
                            "to": tested_method,
                            "type": "tests"
                        })
        
        except Exception as e:
            print(f"Error parsing test {file_path}: {e}")
    
    def _extract_path_from_annotation(self, anno) -> str:
        """Extract path from @GetMapping("/path") etc."""
        if anno.element:
            if isinstance(anno.element, javalang.tree.Literal):
                return anno.element.value.strip('"')
            elif hasattr(anno.element, 'values'):
                for val in anno.element.values:
                    if hasattr(val, 'value') and isinstance(val.value, javalang.tree.Literal):
                        return val.value.value.strip('"')
        return None
    
    def _extract_method_calls(self, method_id: str, method, content: str):
        """Find method calls inside a method body (simple regex approach)"""
        # This is a simplified approach - looks for patterns like "userService.findUser("
        method_call_pattern = r'(\w+)\.(\w+)\('
        
        matches = re.findall(method_call_pattern, content)
        for service_var, method_name in matches:
            # Try to match to known service methods
            possible_target = f"*Service.{method_name}"  # Wildcard for class name
            
            self.graph["edges"].append({
                "from": method_id,
                "to": possible_target,
                "type": "calls"
            })
    
    def _infer_tested_method(self, test_name: str, content: str) -> str:
        """Heuristic to find which method is being tested"""
        # Common patterns: testFindUser, test_find_user, shouldFindUser
        clean_name = re.sub(r'^(test|should)_?', '', test_name, flags=re.IGNORECASE)
        clean_name = clean_name[0].lower() + clean_name[1:]  # camelCase
        
        # Look for method calls in test content
        pattern = rf'\w+\.({clean_name})\('
        match = re.search(pattern, content)
        
        if match:
            return f"*Service.{clean_name}"  # Wildcard match
        
        return None