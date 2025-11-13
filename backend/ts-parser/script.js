// script.js
import { Project, SyntaxKind } from "ts-morph";
import fs from "fs";
import path from "path";

// Accept repo path as command line argument, default to current directory
const REPO_ROOT = process.argv[2] || process.cwd();
const FRONTEND_DIR = path.join(REPO_ROOT, "src");
const ENV_DIR = path.join(FRONTEND_DIR, "environments");

// Output to outputs directory at the same level as repos
// If REPO_ROOT is /path/to/repos/frontend-test, go up 2 levels to get to /path/to
// Then append outputs/frontend_graph.json
const reposParent = path.dirname(path.dirname(REPO_ROOT)); // Go up 2 levels from repos/frontend-test
const OUTPUT_DIR = path.join(reposParent, "outputs");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "frontend_graph.json");

// Create outputs directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
}

// Check if source directory exists
if (!fs.existsSync(FRONTEND_DIR)) {
  console.error(`❌ Source directory not found: ${FRONTEND_DIR}`);
  console.error(`Usage: node script.js <repo_path>`);
  process.exit(1);
}

const project = new Project({ skipAddingFilesFromTsConfig: true });

// Recursively add source files
function addSourceFiles(dir) {
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️  Directory not found: ${dir}`);
    return;
  }

  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      addSourceFiles(filePath);
    } else if (file.endsWith(".ts") || file.endsWith(".js")) {
      try {
        project.addSourceFileAtPath(filePath);
      } catch (err) {
        console.warn(`⚠️  Could not parse ${filePath}: ${err.message}`);
      }
    }
  }
}

console.log(`🔍 Scanning source files in ${FRONTEND_DIR}...`);
addSourceFiles(FRONTEND_DIR);

const apiDetails = [];

// STEP 1 — Extract environment base URLs
const envBaseUrls = {};
if (fs.existsSync(ENV_DIR)) {
  const envFiles = fs.readdirSync(ENV_DIR).filter((f) => f.endsWith(".ts"));
  for (const envFile of envFiles) {
    const envPath = path.join(ENV_DIR, envFile);
    try {
      const src = project.addSourceFileAtPath(envPath);
      src.getVariableDeclarations().forEach((v) => {
        const init = v.getInitializer()?.getText() || "";
        const matches = init.match(/baseUrl\s*:\s*['"`](.*?)['"`]/);
        if (matches) envBaseUrls[envFile] = matches[1];
      });
    } catch (err) {
      console.warn(`⚠️  Could not parse environment file ${envFile}`);
    }
  }
}
console.log("🌍 Found environment base URLs:", envBaseUrls);

// Utility Helpers
function extractLiteralOrExpression(expr) {
  if (!expr) return null;
  if (expr.getKind() === SyntaxKind.StringLiteral) return expr.getLiteralText();
  return expr.getText();
}

function findLocalBaseUrl(file) {
  let base = null;
  file.forEachDescendant((node) => {
    if (
      node.getKind() === SyntaxKind.PropertyDeclaration ||
      node.getKind() === SyntaxKind.VariableDeclaration
    ) {
      const name = node.getName?.();
      const init = node.getInitializer?.()?.getText() || "";
      if (name && /baseUrl|apiBase|apiUrl|rootUrl|API_URL/i.test(name)) {
        const match = init.match(/['"`](.*?)['"`]/);
        if (match) base = match[1];
      }
    }
  });
  return base;
}

function resolveBaseUrl(fileBase, envMatches) {
  if (fileBase) return fileBase;
  if (Object.keys(envMatches).length > 0) return Object.values(envMatches)[0];
  return "";
}

function resolveVariableValue(name, scope) {
  const varDecl = scope
    .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((v) => v.getName() === name);
  if (varDecl) {
    const init = varDecl.getInitializer();
    if (init) return init.getText();
  }
  return name;
}

function expandTemplateLiterals(value, localBaseUrl) {
  if (!value) return value;
  if (value.includes("`")) {
    let expanded = value.replace(/`/g, "");
    expanded = expanded.replace(/\$\{this\.apiUrl\}/g, localBaseUrl || "");
    expanded = expanded.replace(/\$\{this\.baseUrl\}/g, localBaseUrl || "");
    expanded = expanded.replace(/\$\{this\.apiBase\}/g, localBaseUrl || "");
    return expanded;
  }
  return value;
}

// STEP 2 — Parse files for API calls
project.getSourceFiles().forEach((file) => {
  const localBaseUrl = findLocalBaseUrl(file);
  const relativePath = path.relative(REPO_ROOT, file.getFilePath());

  // Parse classes (Angular services/components)
  file.getClasses().forEach((cls) => {
    const className = cls.getName() || "AnonymousClass";
    const decorators = cls.getDecorators().map(
      (d) =>
        d.getName() +
        (d.getArguments().length
          ? `(${d
              .getArguments()
              .map((a) => a.getText())
              .join(", ")})`
          : "")
    );

    const properties = cls.getProperties().map((p) => ({
      name: p.getName(),
      type: p.getType().getText(),
      initializer: p.getInitializer()?.getText() || null,
    }));

    cls.getMethods().forEach((methodDecl) => {
      const methodName = methodDecl.getName();
      const signature = methodDecl.getSignature();
      const parameters = methodDecl.getParameters().map((p) => ({
        name: p.getName(),
        type: p.getType().getText(),
      }));
      const returnType = signature.getReturnType().getText();
      const access = methodDecl.getScope() || "public";
      const jsDoc = methodDecl
        .getJsDocs()
        .map((d) => d.getComment())
        .join("\n");

      // Calculate line and column
      const startPos = methodDecl.getStart();
      const startLine = methodDecl.getStartLineNumber();
      const sourceText = file.getFullText();
      const lineStart = sourceText.lastIndexOf("\n", startPos - 1) + 1;
      const column = startPos - lineStart + 1;
      const location = { line: startLine, column };

      // Detect API calls
      methodDecl.forEachDescendant((node) => {
        if (node.getKind() === SyntaxKind.CallExpression) {
          const callExpr = node;
          const expression = callExpr.getExpression().getText();

          if (
            expression.includes(".http.") ||
            expression.includes("axios.") ||
            expression === "fetch"
          ) {
            let method = "unknown";
            let url = null;
            let params = null;
            let body = null;

            const args = callExpr.getArguments();

            // Angular HttpClient
            if (expression.includes(".http.")) {
              method = expression.split(".http.")[1].split("(")[0];
              url = extractLiteralOrExpression(args[0]);
              if (["post", "put", "patch"].includes(method.toLowerCase()))
                body = extractLiteralOrExpression(args[1]);
              params = args[2] ? extractLiteralOrExpression(args[2]) : null;
            }

            // Axios
            else if (expression.includes("axios.")) {
              method = expression.split("axios.")[1].split("(")[0];
              url = extractLiteralOrExpression(args[0]);
              if (["post", "put", "patch"].includes(method.toLowerCase()))
                body = extractLiteralOrExpression(args[1]);
              params = args[2] ? extractLiteralOrExpression(args[2]) : null;
            }

            // Fetch
            else if (expression === "fetch") {
              url = extractLiteralOrExpression(args[0]);
              const options = args[1]
                ? extractLiteralOrExpression(args[1])
                : null;
              method =
                options?.match(/method\s*:\s*['"`](\w+)['"`]/)?.[1] || "GET";
              body = options?.match(/body\s*:\s*(\{.*?\}|\w+)/)?.[1] || null;
              params = options;
            }

            // Resolve variable identifiers like "url"
            if (url && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(url))
              url = resolveVariableValue(url, methodDecl);

            // Expand template literals
            url = expandTemplateLiterals(url, localBaseUrl);

            // Final full URL
            const baseUrl = resolveBaseUrl(localBaseUrl, envBaseUrls);
            let fullUrl = url;
            if (baseUrl && url && !/^https?:\/\//.test(url)) {
              const cleanBase = baseUrl.replace(/\/$/, "");
              const cleanUrl = url
                .replace(/^['"`]/, "")
                .replace(/['"`]$/, "")
                .replace(/^\//, "");
              fullUrl = `${cleanBase}/${cleanUrl}`;
            }

            // Record result
            apiDetails.push({
              file: relativePath,
              class: className,
              decorators,
              properties,
              function: `${className}.${methodName}`,
              access,
              method,
              url: fullUrl,
              params,
              body,
              parameterDetails: parameters,
              returnType,
              doc: jsDoc,
              location,
            });
          }
        }
      });
    });
  });
});

// STEP 3 — Write output
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(apiDetails, null, 2));
console.log(
  `✅ Deconstruction complete! Extracted ${apiDetails.length} API calls.`
);
console.log(`📄 Detailed output written to ${OUTPUT_FILE}`);
