package com.hackathon.analyzer;

import com.google.gson.Gson;
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
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.google.gson.JsonObject;
import com.github.javaparser.ast.expr.StringLiteralExpr;
import com.github.javaparser.ast.expr.NormalAnnotationExpr;
import com.github.javaparser.ast.expr.MemberValuePair;
import com.github.javaparser.ast.expr.Expression;
import java.io.File;
import java.nio.file.Paths;
import java.nio.file.Files;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.boot.CommandLineRunner;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.springframework.beans.factory.annotation.Value;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Comparator;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

@Service
public class AnalyzerService implements CommandLineRunner {

	@Value("${backend.url}")
	private String serverUrl;

	@Override
	public void run(String... args) throws Exception {
		if (args.length < 3) {
			System.out.println("Enter Commid, URL, Tag");
			System.exit(1);
		}
		String commitSha = args[0]; 
		String repoUrl = args[1];
		String tagName = args[2];

                
                System.out.println("--- Received GitHub Context ---");
                System.out.println("Commit SHA: " + commitSha);
                System.out.println("Repo URL: " + repoUrl);
                System.out.println("Tag Name: " + tagName);
                System.out.println("-----------------------------");


		try{
			String repoPath = cloneRepo(repoUrl, commitSha);
			List<ControllerMethodInfo>  data = parse(repoPath);
			JsonObject jsonObject = new JsonObject();
			jsonObject.addProperty("repo_url", repoUrl);
			jsonObject.addProperty("commit", commitSha);
			jsonObject.addProperty("tag_name", tagName);

			Gson gson = new Gson();
			jsonObject.add("data", gson.toJsonTree(data));
			String finalData = gson.toJson(jsonObject);
			sendPostRequest(serverUrl,finalData);
			System.exit(0);
		} catch(Exception e) {
			System.out.println(e);
			System.exit(1);
		} 	
	}

	public List<ControllerMethodInfo>  parse(String repoPath) throws Exception{
		System.out.println("Parsing " + repoPath);
		Map<String, Map<String, String>> typeFieldsMap = new HashMap<>();
		List<File> javaFiles = Files.walk(new File(repoPath).toPath())
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
						Optional<AnnotationExpr> classMapping = controller.getAnnotationByName("RequestMapping");
                                                if (classMapping.isEmpty()) {
                                                    classMapping = controller.getAnnotationByName("RestController");
                                                }
                                                if (classMapping.isEmpty()) {
                                                    classMapping = controller.getAnnotationByName("Controller");
                                                }
                                                
						String classPath = "";
                                                if (classMapping.isPresent()) {
                                                    AnnotationExpr annotation = classMapping.get();
                                                    
                                                    if (annotation.isSingleMemberAnnotationExpr()) {
                                                        Expression value = annotation.asSingleMemberAnnotationExpr().getMemberValue();
                                                        if (value.isStringLiteralExpr()) {
                                                            classPath = value.asStringLiteralExpr().getValue();
                                                        }
                                                    }
                                                }

						final String basePath  = classPath;
						controller.findAll(MethodDeclaration.class).forEach( method -> {
						Optional<AnnotationExpr> requestMapping = method.getAnnotationByName("RequestMapping");
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
						patchMapping.isPresent() || deleteMapping.isPresent() || requestMapping.isPresent()) {
							String path = basePath +  ( getMapping.isPresent() ? 
							getMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).orElse("/") : postMapping.isPresent() ?
							postMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).orElse("/") : putMapping.isPresent() ?
							putMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).orElse("/") : patchMapping.isPresent() ?
							patchMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).orElse("/") : deleteMapping.isPresent() ?
							deleteMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).orElse("/") : "");

							if (requestMapping.isPresent()) {
								if (requestMapping.isPresent()) {
                                                                    AnnotationExpr annotation = requestMapping.get();
                                                                    if (annotation.isNormalAnnotationExpr()) {
                                                                        NormalAnnotationExpr normalAnnotation = annotation.asNormalAnnotationExpr();
                                                                        
                                                                        for (MemberValuePair pair : normalAnnotation.getPairs()) {
                                                                            String name = pair.getNameAsString();
                                                                            Expression value = pair.getValue();
                                                                            if (name.equals("value") || name.equals("path")) {
                                                                                if (value.isStringLiteralExpr()) {
                                                                                    path = value.asStringLiteralExpr().getValue();
                                                                                }
                                                                            } 
                                                                            else if (name.equals("method")) {
                                                                                httpMethod = value.toString(); // e.g., RequestMethod.POST
                                                                            }
                                                                        }
                                                                    } 
                                                                    
                                                                    else if (annotation.isSingleMemberAnnotationExpr()) {
                                                                        Expression value = annotation.asSingleMemberAnnotationExpr().getMemberValue();
                                                                        if (value.isStringLiteralExpr()) {
                                                                            path = value.asStringLiteralExpr().getValue();
                                                                        }
                                                                    }
								}
							}

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
							info.FileName = file.getName();
							info.Method = httpMethod;
							controllerInfos.add(info);
						}
					});
						});
			}catch (Exception ignored) {
			}
		}

		return controllerInfos;
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
		public String FileName;
		public String Method;
	}



	private String cloneRepo(String repoUrl, String commitId) throws IOException, GitAPIException{
		Path tempRepoDir = Files.createTempDirectory("git-analysis-");
		Git git = null;

		try{
			 git = Git.cloneRepository()
				.setURI(repoUrl)
				.setDirectory(tempRepoDir.toFile())
				.setNoCheckout(false)
				.call();

			git.checkout()
				.setName(commitId)
				.call();


		}catch (GitAPIException | RuntimeException e) {
			throw e;
		}finally {
			if (git != null) {
			    git.close();
			}
		}

		return tempRepoDir.toString();
	}

        public void sendPostRequest(String serverUrl, String data)
                    throws IOException, InterruptedException {
                
		try{
                HttpClient client = HttpClient.newBuilder().build();
		System.out.println("Sending post request: " +  data);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(serverUrl + "/api/scan"))
                        .header("Content-Type", "application/json") 
                        .POST(HttpRequest.BodyPublishers.ofString(data)) 
                        .build();
        
                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        
                System.out.println("✅ POST Request Sent Successfully");
		System.out.println("Status Code: " + response.statusCode());
		} catch (Exception e){
			System.out.println("Error while sending data: "+ e.toString());
			throw e;
		}
	}   
}
