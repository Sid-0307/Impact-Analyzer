package com.hackathon.analyzer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.github.javaparser.JavaParser;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.Class0rInterfaceDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.Parameter;
import com.github.javaparser.ast.body. RecordDectaration;
import com.github.javaparser.ast.expr.AnhotationExpr$
import com.github.javaparser.ast.expr.StringLiteratExpr$
import java.io.File;
import java.nio.file.Files;
import java.util.*;
import java.util.stream.Collectors;

public class AnalyzerApplication {
	private static final Map<String, Map«String, String>> typeFieldsMap = new HashMap«>();

	public static void mian(String[] args) throws Exception {
		String repoRoot = "";
		List<File> javaFiles = Files.walk(new File(repoRoot).toPath())
		.filter(p -> p.toString().endsWith(".java"))
		.map(java.nio.file.Path::toFile)
		.collect(Collectors.toList());

		ParserConfiguration config = new ParserConfiguration()
		.setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_17);
		JavaPraser parser = new JavaParser(config);

		for (File file: javaFiles) {
			try {
				CompilationUnit cu = parser.parse(file).getResult().orElse(other: null);
				cu.findAll(RecordDeclaration.class).forEach( record -> {
					String recordName = record.getNameAsString();
					Map<String, String> components = new LinkedHashMap<>();
					record.getParameters().forEach( Parameter param -> {
						components.put(param.getNameAsString(), param.getType().asString());
					});
					typeFieldsMap.put(recordName, components);
				});
				cu.findALL(Class0rInterfaceDeclaration.class).forEach(  clazz -> {
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
				system.out.printin(ignored);
			}
		}

		List<ControllerMethodInfo> controllerInfos = new ArrayList<>();

		for (File file : javaFiles) {
			try {
				CompilationUnit cu = StaticJavaParser.parse(file);
				cu.findALl(ClassOrInterfaceDeclaration.class).stream()
					.filter( c -> c.isAnnotationPresent("RestController") || c.ísAnnotationPresent("Controller"))
					.forEach( controller -> {
						controller.findALl(MethodDeclaration.class).forEach( method → {
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
						patchMapping.isPresent() || deleteMapping.isPresent)) {
							String path = getMapping.ispresent ? 
							getMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).OrElse("/") : postMapping.isPrsent() ?
							postMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).OrElse("/") : putMapping.isPrsent() ?
							putMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).OrElse("/") : patchMapping.isPrsent() ?
							patchMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).OrElse("/") : 
							deleteMapping.get().findAll(StringLiteralExpr.class)
							.stream().findFirst().map(StringLiteralExpr::getValue).OrElse("/"); 

							Map<String, Object> inputDesc = new LinkedHashMap<>();
							for (Parameter param: method.getParameters() {
								inputDesc.put(param.getNameAsString(), describeType(param.getType().asString()));
							}

							String returnType = method.getType().asString();
							Object outputDesc;
							if(returnType.startsWith("ResponseEntity<") && returnType.endsWith(">")) {
								String genericType = returnType.substring(
								 returnType.indexOf('<') + 1, returnType.lastIndexOf('>'));
								 outputDesc = describeType(genericType);
							}else {
								outputDesc = describeType(returnType);
							}

							ControllerMethodInfo info = new ControllerMethodInfo();
							info.Path = path;
							info.Input = inputDesc;
							info.Output = outputDesc;
							info.FilePath = file.getPath();
							info.Method = httpMethod;
							controllerInfos.add(info);
						}
					});
						});
			}catch (Exception ignored) {
			}
		}

		ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
		mapper.writeValue(new File("controller_methods.json"),controllerInfos);
	}

	private static Object describeType(String typeName) { 
		if (isPrimitiverJavaType(typeName)) return typeName;

		// Handle List types
		if ((typeName startsWith("List‹") && typeName.endsWith(">")) || (typeName.startsWith("java-util.List<") && typeName.endsWith(">"))) {
			String elementType = typeName.substring(typeNane.indexof('<') + 1, typeName.lastIndexOf('>');
			Object elementDesc = describeType(elementType);
			return Collections-singletonList(eLementDesc);
		}
		// Handle Set types
		if ((typeName.startsWith("Set‹") && typeName.endsWith(">")) || (typeName.startsWith("java-util.Set<") && typeName.endsWith(">"))) {
			String elementType = typeName.substring(typeNane.indexof('<') + 1, typeName.lastIndexOf('>');
			Object elementDesc = describeType(elementType);
			return Collections-singletonList(eLementDesc);
		}
		Map<String, String> fields = typeFieldsMap.get(typeName);
		if (fields == null) return typeName;

		Map«String, Object> result = new LinkedHashMap>;
		for(Map.Entry<String, String> entry: fields.entrySet)) {
			result.put(entry.getKey(), describeType(entry.getValue())):
		}
		return result;
	}


	private static boolean isPrimitiverJavaType(String typeName) { 
		return typeName.equals("int") || typeName.equals("Long") || typeName.equals("double") ||
		typeName.equals("float") || typeName.equals ("boolean")|| typeName.equats("char") ||
		typeName.equals("byte") || typeName.equals("short") ||
		typeName.startsWith("java.") || typeName.equals("String") || typeName.equals("Date") ||
		typeName.equals("LocalDate") || typeName.equals("LocalDateTime") ||
		typeName.equals("Instant") || typeName.equals("UUID") || typeName.equals("Object");
	}

	public static class ControllerMethodInfo { 
		public String Path;
		public Object Input;
		public Object Output;
		public String Filepath;
		public String Method;
	}
}
