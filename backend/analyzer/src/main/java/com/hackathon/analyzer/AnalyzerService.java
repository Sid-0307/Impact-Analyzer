package com.hackathon.analyzer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.github.javaparser.JavaParser;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.Parameter;
import com.github.javaparser.ast.body.RecordDeclaration;
import com.github.javaparser.ast.expr.AnnotationExpr;
import com.github.javaparser.ast.expr.StringLiteralExpr;
import java.io.File;
import java.nio.file.Files;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Comparator;

public class AnalyzerService {

	public String parse(String url) throws Exception{
		Map<String, Map<String, String>> typeFieldsMap = new HashMap<>();
		String repoRoot = cloneRepo(url);
		List<File> javaFiles = Files.walk(new File(repoRoot).toPath())
		.filter(p -> p.toString().endsWith(".java"))
		.map(java.nio.file.Path::toFile)
		.collect(Collectors.toList());

		ParserConfiguration config = new ParserConfiguration()
			.setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_17);
		JavaParser parser = new JavaParser(config);

		for (File file: javaFiles) {
			try {
				CompilationUnit cu = parser.parse(file).getResult().orElse(null);
				cu.findAll(RecordDeclaration.class).forEach( record -> {
					String recordName = record.getNameAsString();
					Map<String, String> components = new LinkedHashMap<>();
					record.getParameters().forEach( param -> {
						components.put(param.getNameAsString(), param.getType().asString());
					});
					typeFieldsMap.put(recordName, components);
				});
				cu.findAll(ClassOrInterfaceDeclaration.class).forEach( clazz -> {
					String className = clazz.getNameAsString();
					Map<String, String> fields = new LinkedHashMap<>();
					clazz.getFields().forEach(  field -> {
						field.getVariables().forEach(  var -> {
							fields.put(var.getNameAsString(), var.getType().asString());
						});
					});
					typeFieldsMap.put(className, fields);
				});
			}catch (Exception ignored) {
				System.out.println(ignored);
			}
		}

		List<ControllerMethodInfo> controllerInfos = new ArrayList<>();

		for (File file : javaFiles) {
			try {
				CompilationUnit cu = StaticJavaParser.parse(file);
				cu.findAll(ClassOrInterfaceDeclaration.class).stream()
					.filter( c -> c.isAnnotationPresent("RestController") || c.isAnnotationPresent("Controller"))
					.forEach( controller -> {
						controller.findAll(MethodDeclaration.class).forEach( method -> {
						Optional<AnnotationExpr> getMapping = method.getAnnotationByName("GetMapping");
						Optional<AnnotationExpr> postMapping = method.getAnnotationByName(  "PostMapping");
						Optional<AnnotationExpr> putMapping = method.getAnnotationByName(  "PutMapping");
						Optional<AnnotationExpr> patchMapping = method.getAnnotationByName(  "PatchMapping");
						Optional<AnnotationExpr> deleteMapping = method.getAnnotationByName( "DeleteMapping");
						String httpMethod = getMapping.isPresent() ? "GET" :
						postMapping.isPresent() ? "POST" :
						putMapping.isPresent() ? "PUT" :
						patchMapping.isPresent() ? "PATCH" :
						deleteMapping.isPresent() ? "DELETE" : "UNKNOWN";
						if (getMapping.isPresent() || postMapping.isPresent() || putMapping.isPresent() ||
						patchMapping.isPresent() || deleteMapping.isPresent()) {
							String path = getMapping.isPresent() ? 
							getMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).orElse("/") : postMapping.isPresent() ?
							postMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).orElse("/") : putMapping.isPresent() ?
							putMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).orElse("/") : patchMapping.isPresent() ?
							patchMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).orElse("/") : 
							deleteMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).orElse("/"); 

							Map<String, Object> inputDesc = new LinkedHashMap<>();
							for (Parameter param: method.getParameters()) {
								inputDesc.put(param.getNameAsString(), describeType(param.getType().asString(), typeFieldsMap));
							}

							String returnType = method.getType().asString();
							Object outputDesc;
							if(returnType.startsWith("ResponseEntity<") && returnType.endsWith(">")) {
								String genericType = returnType.substring(
								 returnType.indexOf('<') + 1, returnType.lastIndexOf('>'));
								 outputDesc = describeType(genericType,typeFieldsMap);
							}else {
								outputDesc = describeType(returnType,typeFieldsMap);
							}

							ControllerMethodInfo info = new ControllerMethodInfo();
							info.Path = path;
							info.Input = inputDesc;
							info.Output = outputDesc;
							info.Filepath = file.getPath();
							info.Method = httpMethod;
							controllerInfos.add(info);
						}
					});
						});
			}catch (Exception ignored) {
			}
		}

		ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
		return mapper.writeValueAsString(controllerInfos);
	}


	private Object describeType(String typeName, Map<String, Map<String, String>> typeFieldsMap) { 
		if (isPrimitiverJavaType(typeName)) return typeName;

		// Handle List types
		if ((typeName.startsWith("List‹") && typeName.endsWith(">")) || (typeName.startsWith("java-util.List<") && typeName.endsWith(">"))) {
			String elementType = typeName.substring(typeName.indexOf('<') + 1, typeName.lastIndexOf('>'));
			Object elementDesc = describeType(elementType,typeFieldsMap);
			return Collections.singletonList(elementDesc);
		}
		// Handle Set types
		if ((typeName.startsWith("Set‹") && typeName.endsWith(">")) || (typeName.startsWith("java-util.Set<") && typeName.endsWith(">"))) {
			String elementType = typeName.substring(typeName.indexOf('<') + 1, typeName.lastIndexOf('>'));
			Object elementDesc = describeType(elementType, typeFieldsMap);
			return Collections.singletonList(elementDesc);
		}
		Map<String, String> fields = typeFieldsMap.get(typeName);
		if (fields == null) return typeName;

		Map<String, Object> result = new LinkedHashMap<>();
		for(Map.Entry<String, String> entry: fields.entrySet()) {
			result.put(entry.getKey(), describeType(entry.getValue(),typeFieldsMap));
		}
		return result;
	}


	private boolean isPrimitiverJavaType(String typeName) { 
		return typeName.equals("int") || typeName.equals("Long") || typeName.equals("double") ||
		typeName.equals("float") || typeName.equals ("boolean")|| typeName.equals("char") ||
		typeName.equals("byte") || typeName.equals("short") ||
		typeName.startsWith("java.") || typeName.equals("String") || typeName.equals("Date") ||
		typeName.equals("LocalDate") || typeName.equals("LocalDateTime") ||
		typeName.equals("Instant") || typeName.equals("UUID") || typeName.equals("Object");
	}

	public class ControllerMethodInfo { 
		public String Path;
		public Object Input;
		public Object Output;
		public String Filepath;
		public String Method;
	}



	private String cloneRepo(String repoUrl) throws IOException, GitAPIException {
Path tempRepoDir = Files.createTempDirectory("git-analysis-");
        System.out.println("Cloning repository from " + repoUrl + " into: " + tempRepoDir);

        try {
            // 2. Clone the repository
            Git.cloneRepository()
                .setURI(repoUrl)
                .setDirectory(tempRepoDir.toFile())
                .call();

            // 3. Construct the path to src/main
            Path srcMainPath = tempRepoDir.resolve("src").resolve("main");

            // 4. Validate that the directory exists (common convention for Java/Maven/Gradle projects)
            if (!Files.exists(srcMainPath) || !Files.isDirectory(srcMainPath)) {
                // If the path doesn't exist, we clean up the temporary directory immediately
                cleanup(tempRepoDir);
                throw new RuntimeException("Could not find 'src/main' directory in the cloned repository at: " + srcMainPath);
            }

            System.out.println("Successfully cloned and found src/main at: " + srcMainPath);
            // Return the path. The caller is responsible for cleaning up the tempRepoDir 
            // once analysis is complete using the cleanup method provided below.
            return srcMainPath.toString();

        } catch (GitAPIException | RuntimeException e) {
            // Ensure cleanup is attempted if cloning or path validation fails
            cleanup(tempRepoDir);
            throw e; 
        }
	}


public void cleanup(Path repoPath) {
        if (repoPath == null || !Files.exists(repoPath)) {
            return;
        }
        System.out.println("Initiating cleanup of temporary directory: " + repoPath);
        try {
            Files.walk(repoPath)
                 // Sort in reverse order (files before directories) for safe deletion
                .sorted(Comparator.reverseOrder()) 
                .map(Path::toFile)
                .forEach(File::delete);
            System.out.println("Cleanup successful.");
        } catch (IOException e) {
            System.err.println("Failed to delete directory " + repoPath + ": " + e.getMessage());
        }
    }
}
