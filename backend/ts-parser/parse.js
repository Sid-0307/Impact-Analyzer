const { Project } = require("ts-morph");
const path = require("path");
const fs = require("fs");

const repoPath = process.argv[2];
if (!repoPath) {
  console.error("Usage: node parse.js <repo_path>");
  process.exit(1);
}

// Check if tsconfig exists, if not use default config
const tsConfigPath = path.join(repoPath, "tsconfig.json");
const hasTsConfig = fs.existsSync(tsConfigPath);

const project = new Project({
  ...(hasTsConfig ? { tsConfigFilePath: tsConfigPath } : {}),
  skipAddingFilesFromTsConfig: true,
});

// Add all TypeScript files
project.addSourceFilesAtPaths(`${repoPath}/src/**/*.ts`);

const graph = {
  nodes: [],
  edges: [],
  http_calls: [],
};

// Helper to normalize paths
function normalizePath(filePath) {
  return filePath.replace(repoPath + "/", "").replace(/\\/g, "/");
}

// Parse all TypeScript files
for (const sourceFile of project.getSourceFiles()) {
  const filePath = normalizePath(sourceFile.getFilePath());

  // Skip test files (will handle separately)
  const isTestFile =
    filePath.includes(".spec.ts") || filePath.includes(".test.ts");

  // Find classes (Services, Components, etc.)
  for (const classDecl of sourceFile.getClasses()) {
    const className = classDecl.getName();
    if (!className) continue;

    const isService = className.endsWith("Service");
    const isComponent = className.endsWith("Component");

    // Get constructor dependencies (injected services)
    const constructor = classDecl.getConstructors()[0];
    const injectedServices = [];

    if (constructor) {
      for (const param of constructor.getParameters()) {
        const paramType = param.getType().getText();
        injectedServices.push({
          name: param.getName(),
          type: paramType,
        });
      }
    }

    // Parse methods
    for (const method of classDecl.getMethods()) {
      const methodName = method.getName();
      const methodId = `${className}.${methodName}`;

      // Add node (skip test files for now)
      if (!isTestFile) {
        graph.nodes.push({
          id: methodId,
          type: isService
            ? "angular_service"
            : isComponent
            ? "angular_component"
            : "angular_class",
          file: filePath,
          class: className,
          injected_services: injectedServices,
        });
      }

      // Get method body
      const methodBody = method.getBodyText() || "";

      // === Find HTTP calls ===

      // Pattern 1: this.http.get('/api/users')
      const httpClientPattern =
        /this\.http\.(get|post|put|delete|patch)\s*<[^>]*>?\s*\(\s*['"`]([^'"`]+)['"`]/g;
      let match;

      while ((match = httpClientPattern.exec(methodBody)) !== null) {
        const [_, httpMethod, url] = match;

        graph.http_calls.push({
          source: methodId,
          url: url,
          method: httpMethod.toUpperCase(),
          file: filePath,
          type: "HttpClient",
        });
      }

      // Pattern 2: this.http.post(url, data) where url is a variable
      const httpClientVarPattern =
        /this\.http\.(get|post|put|delete|patch)\s*<[^>]*>?\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
      while ((match = httpClientVarPattern.exec(methodBody)) !== null) {
        const [_, httpMethod, urlVar] = match;

        // Try to find URL value in method
        const urlValueMatch = new RegExp(
          `(const|let|var)\\s+${urlVar}\\s*=\\s*['"\`]([^'"\`]+)['"\`]`
        ).exec(methodBody);

        if (urlValueMatch) {
          graph.http_calls.push({
            source: methodId,
            url: urlValueMatch[2],
            method: httpMethod.toUpperCase(),
            file: filePath,
            type: "HttpClient",
          });
        }
      }

      // Pattern 3: fetch('/api/users')
      const fetchPattern = /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g;
      while ((match = fetchPattern.exec(methodBody)) !== null) {
        graph.http_calls.push({
          source: methodId,
          url: match[1],
          method: "GET", // Default for fetch
          file: filePath,
          type: "fetch",
        });
      }

      // Pattern 4: axios.get('/api/users')
      const axiosPattern =
        /axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
      while ((match = axiosPattern.exec(methodBody)) !== null) {
        const [_, httpMethod, url] = match;

        graph.http_calls.push({
          source: methodId,
          url: url,
          method: httpMethod.toUpperCase(),
          file: filePath,
          type: "axios",
        });
      }

      // === Find method calls (component → service) ===

      // Pattern: this.userService.getUser()
      const methodCallPattern =
        /this\.([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
      while ((match = methodCallPattern.exec(methodBody)) !== null) {
        const [_, serviceName, calledMethod] = match;

        // Try to resolve service type from constructor
        const injectedService = injectedServices.find(
          (s) => s.name === serviceName
        );
        const targetClass = injectedService
          ? injectedService.type
          : `*${calledMethod}`;

        graph.edges.push({
          from: methodId,
          to: targetClass.includes(".")
            ? targetClass
            : `${targetClass}.${calledMethod}`,
          type: "calls",
          service_var: serviceName,
        });
      }

      // Pattern: Direct service call without this (for services calling other services)
      const directCallPattern =
        /([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
      while ((match = directCallPattern.exec(methodBody)) !== null) {
        const [_, objectName, calledMethod] = match;

        // Skip common false positives
        if (
          [
            "console",
            "window",
            "document",
            "Math",
            "Object",
            "Array",
            "JSON",
          ].includes(objectName)
        ) {
          continue;
        }

        // Check if it's an injected service
        const injectedService = injectedServices.find(
          (s) => s.name === objectName
        );
        if (injectedService) {
          graph.edges.push({
            from: methodId,
            to: `${injectedService.type}.${calledMethod}`,
            type: "calls",
            service_var: objectName,
          });
        }
      }
    }
  }

  // === Parse test files ===
  if (isTestFile) {
    // Find test functions
    const testPattern =
      /it\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(async\s*)?\(\s*\)\s*=>\s*\{([^}]+)\}/g;
    const fileContent = sourceFile.getText();

    while ((match = testPattern.exec(fileContent)) !== null) {
      const [_, testDescription, isAsync, testBody] = match;

      // Try to find what's being tested
      const serviceMatch = /(\w+Service)/.exec(fileContent);
      const componentMatch = /(\w+Component)/.exec(fileContent);

      const testedClass = serviceMatch
        ? serviceMatch[1]
        : componentMatch
        ? componentMatch[1]
        : "Unknown";

      // Find method calls in test
      const methodCallInTest = /(\w+)\s*\.\s*(\w+)\s*\(/.exec(testBody);

      if (methodCallInTest) {
        const [_, obj, method] = methodCallInTest;

        graph.edges.push({
          from: `Test::${testDescription}`,
          to: `${testedClass}.${method}`,
          type: "tests",
          file: filePath,
        });
      }
    }
  }
}

// Output as JSON
console.log(JSON.stringify(graph, null, 2));
