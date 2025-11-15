import javalang
import os
import re
from pathlib import Path
from typing import Dict, List

from py4j.java_gateway import JavaGateway

class JavaParser:
    def __init__(self, git_url: str):
        self.git_url = git_url
        self.graph = {"nodes": [], "edges": [], "endpoints": []}
    
    def parse(self) -> Dict:
        try:
            gateway = JavaGateway()
        except Exception as e:
            print(f"Could not connect to Java Gateway. Is the Spring app running? Error: {e}")
            return self.graph
        entry_point = gateway.entry_point
        service = entry_point.getService()
        result = service.parse(this.git_url)
        print(result)
        return self.graph
    
    def _parse_source_file(self, file_path: Path):
        """Parse controllers, services, and models"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            tree = javalang.parse.parse(content)
            
            for path, node in tree.filter(javalang.tree.ClassDeclaration):
                class_name = node.name
                
                # Check annotations
                annotations = [anno.name for anno in (node.annotations or [])]
                
                is_controller = any(a in ['RestController', 'Controller'] for a in annotations)
                is_service = 'Service' in annotations
                is_repository = 'Repository' in annotations
                is_entity = 'Entity' in annotations
                
                # Track ALL classes (models, entities, etc.)
                is_model = not (is_controller or is_service or is_repository) and not is_entity
                
                # Add class node
                class_id = f"{class_name}"
                class_type = 'controller' if is_controller else 'service' if is_service else 'repository' if is_repository else 'entity' if is_entity else 'model'
                
                self.graph["nodes"].append({
                    "id": class_id,
                    "type": class_type,
                    "file": str(file_path.relative_to(self.repo_path))
                })
                
                # Parse fields to track model dependencies
                for field in node.fields:
                    field_type = self._get_field_type(field)
                    if field_type and field_type != class_name:
                        # Model uses another model/entity
                        self.graph["edges"].append({
                            "from": class_id,
                            "to": field_type,
                            "type": "uses"
                        })
                
                # Parse methods
                for method in node.methods:
                    method_id = f"{class_name}.{method.name}"
                    
                    if is_controller:
                        self._parse_controller_method(method_id, method, file_path, content, class_name)
                    else:
                        # Add method node for services/models
                        self.graph["nodes"].append({
                            "id": method_id,
                            "type": f"{class_type}_method",
                            "file": str(file_path.relative_to(self.repo_path)),
                            "class": class_name
                        })
                    
                    # Track method parameter types (models used)
                    for param in method.parameters:
                        param_type = self._get_type_name(param.type)
                        if param_type:
                            self.graph["edges"].append({
                                "from": method_id,
                                "to": param_type,
                                "type": "uses"
                            })
                    
                    # Track return type
                    if method.return_type:
                        return_type = self._get_type_name(method.return_type)
                        if return_type:
                            self.graph["edges"].append({
                                "from": method_id,
                                "to": return_type,
                                "type": "returns"
                            })
                    
                    # Find method calls
                    self._extract_method_calls(method_id, method, content)
        
        except Exception as e:
            print(f"Error parsing {file_path}: {e}")
    
    def _parse_controller_method(self, method_id: str, method, file_path: Path, content: str, class_name: str):
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
            "type": "controller_method",
            "file": str(file_path.relative_to(self.repo_path)),
            "class": class_name,
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
    
    
    def _get_field_type(self, field) -> str:
        """Extract field type name"""
        if hasattr(field, 'type'):
            return self._get_type_name(field.type)
        return None
    
    def _get_type_name(self, type_obj) -> str:
        """Extract type name from javalang type object"""
        if not type_obj:
            return None
        
        if hasattr(type_obj, 'name'):
            return type_obj.name
        
        if hasattr(type_obj, 'type') and hasattr(type_obj.type, 'name'):
            return type_obj.type.name  # For generics like List<Model>
        
        return str(type_obj)
    
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
