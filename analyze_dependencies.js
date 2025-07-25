#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

// Configuration
const CONFIG = {
  supportedExtensions: [".js", ".jsx", ".ts", ".tsx", ".py"],
  excludePatterns: [
    "node_modules",
    ".git",
    "__pycache__",
    ".pytest_cache",
    "dist",
    "build",
    ".next",
    "coverage",
  ],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  outputFormats: ["json", "js"],
  defaultOutputFormat: "json",
};

// CLI argument parsing
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    repoPath: null,
    outputFile: path.join(__dirname, "network-data.json"),
    outputFormat: CONFIG.defaultOutputFormat,
    includeExternal: false,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "-o":
      case "--output":
        if (i + 1 < args.length) {
          options.outputFile = args[++i];
        }
        break;
      case "-f":
      case "--format":
        if (i + 1 < args.length) {
          const format = args[++i];
          if (CONFIG.outputFormats.includes(format)) {
            options.outputFormat = format;
          } else {
            console.error(
              `Invalid format: ${format}. Supported: ${CONFIG.outputFormats.join(", ")}`,
            );
            process.exit(1);
          }
        }
        break;
      case "--include-external":
        options.includeExternal = true;
        break;
      case "-v":
      case "--verbose":
        options.verbose = true;
        break;
      default:
        if (!options.repoPath && !arg.startsWith("-")) {
          options.repoPath = arg;
        }
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Repository Dependency Graph Analyzer

Usage: node analyze_dependencies.js [options] <repository_path>

Arguments:
  repository_path              Path to the repository to analyze

Options:
  -h, --help                  Show this help message
  -o, --output <file>         Output file path (default: network-data.json)
  -f, --format <format>       Output format: json, js (default: json)
  --include-external          Include external dependencies (npm, pip packages)
  -v, --verbose               Verbose output

Examples:
  node analyze_dependencies.js /path/to/repo
  node analyze_dependencies.js -o graph.json -f json /path/to/repo
  node analyze_dependencies.js --verbose --include-external /path/to/repo

Supported file types: ${CONFIG.supportedExtensions.join(", ")}
  `);
}

// Utility functions
function log(message, verbose = false, isVerbose = false) {
  if (!isVerbose || verbose) {
    console.log(message);
  }
}

function isExcludedPath(filePath, repoPath) {
  const relativePath = path.relative(repoPath, filePath);
  return CONFIG.excludePatterns.some(
    (pattern) =>
      relativePath.includes(pattern) || path.basename(filePath).startsWith("."),
  );
}

function getFilesInDir(dir, repoPath, fileList = [], verbose = false) {
  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);

      // Skip excluded paths
      if (isExcludedPath(filePath, repoPath)) {
        continue;
      }

      try {
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          getFilesInDir(filePath, repoPath, fileList, verbose);
        } else if (CONFIG.supportedExtensions.includes(path.extname(file))) {
          // Check file size
          if (stat.size > CONFIG.maxFileSize) {
            log(
              `Skipping large file: ${filePath} (${Math.round(stat.size / 1024 / 1024)}MB)`,
              verbose,
              true,
            );
            continue;
          }
          fileList.push(filePath);
        }
      } catch (statError) {
        log(
          `Warning: Cannot stat ${filePath}: ${statError.message}`,
          verbose,
          true,
        );
      }
    }
  } catch (readError) {
    log(
      `Warning: Cannot read directory ${dir}: ${readError.message}`,
      verbose,
      true,
    );
  }

  return fileList;
}

// Enhanced dependency extraction for JavaScript/TypeScript
function getJavaScriptDependencies(filePath, verbose = false) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const dependencies = new Set();

    // CommonJS require patterns
    const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

    // ES6 import patterns
    const importRegex =
      /import\s+(?:(?:[\w*\s{},]*\s+from\s+)?['"`]([^'"`]+)['"`]|['"`]([^'"`]+)['"`])/g;

    // Dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

    // Export from patterns
    const exportFromRegex =
      /export\s+(?:\*|\{[^}]*\})\s+from\s+['"`]([^'"`]+)['"`]/g;

    let match;

    // Extract CommonJS requires
    while ((match = requireRegex.exec(content)) !== null) {
      dependencies.add(match[1]);
    }

    // Extract ES6 imports
    while ((match = importRegex.exec(content)) !== null) {
      const dep = match[1] || match[2];
      if (dep) dependencies.add(dep);
    }

    // Extract dynamic imports
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      dependencies.add(match[1]);
    }

    // Extract export from statements
    while ((match = exportFromRegex.exec(content)) !== null) {
      dependencies.add(match[1]);
    }

    return Array.from(dependencies);
  } catch (error) {
    log(`Warning: Error reading ${filePath}: ${error.message}`, verbose, true);
    return [];
  }
}

// Enhanced dependency extraction for Python
function getPythonDependencies(filePath, verbose = false) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const dependencies = new Set();

    // Regular import: import module, import package.submodule
    const importRegex = /^import\s+([a-zA-Z0-9_.]+)(?:\s+as\s+\w+)?/gm;

    // From import: from module import something, from .relative import something
    const fromImportRegex = /^from\s+([.a-zA-Z0-9_]+)\s+import/gm;

    let match;

    // Extract regular imports
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.add(match[1]);
    }

    // Extract from imports
    while ((match = fromImportRegex.exec(content)) !== null) {
      dependencies.add(match[1]);
    }

    return Array.from(dependencies);
  } catch (error) {
    log(`Warning: Error reading ${filePath}: ${error.message}`, verbose, true);
    return [];
  }
}

// Enhanced path resolution
function resolvePath(
  dependency,
  currentFilePath,
  repoPath,
  includeExternal = false,
) {
  const currentDir = path.dirname(currentFilePath);
  const fileExtension = path.extname(currentFilePath);

  // Skip external dependencies unless requested
  if (
    !includeExternal &&
    !dependency.startsWith(".") &&
    !dependency.startsWith("/")
  ) {
    if ([".js", ".jsx", ".ts", ".tsx"].includes(fileExtension)) {
      // Skip npm packages
      return null;
    } else if (fileExtension === ".py") {
      // Skip pip packages (standard library and third-party)
      const standardLibraryModules = [
        "os",
        "sys",
        "json",
        "datetime",
        "collections",
        "itertools",
        "functools",
        "operator",
        "pathlib",
        "re",
        "urllib",
        "http",
        "asyncio",
        "concurrent",
        "multiprocessing",
        "threading",
      ];
      if (standardLibraryModules.includes(dependency.split(".")[0])) {
        return null;
      }
    }
  }

  if ([".js", ".jsx", ".ts", ".tsx"].includes(fileExtension)) {
    if (dependency.startsWith("./") || dependency.startsWith("../")) {
      let resolved = path.resolve(currentDir, dependency);

      // Try different extensions
      const extensions = [
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        "/index.js",
        "/index.ts",
      ];
      for (const ext of extensions) {
        const candidate = resolved + ext;
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }

      // Try as directory with index file
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        for (const indexFile of [
          "index.js",
          "index.ts",
          "index.jsx",
          "index.tsx",
        ]) {
          const indexPath = path.join(resolved, indexFile);
          if (fs.existsSync(indexPath)) {
            return indexPath;
          }
        }
      }
    }
  } else if (fileExtension === ".py") {
    if (dependency.startsWith(".")) {
      // Relative import
      let resolved = currentDir;
      const parts = dependency.split(".");
      let dots = 0;

      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === "") {
          dots++;
        } else {
          break;
        }
      }

      const remainingParts = parts.slice(dots);

      // Go up directories for relative imports
      for (let i = 0; i < dots - 1; i++) {
        resolved = path.dirname(resolved);
      }

      if (remainingParts.length > 0) {
        resolved = path.join(resolved, ...remainingParts);
      }

      // Try as Python file
      const pyFile = resolved + ".py";
      if (fs.existsSync(pyFile)) {
        return pyFile;
      }

      // Try as package with __init__.py
      const initFile = path.join(resolved, "__init__.py");
      if (fs.existsSync(initFile)) {
        return initFile;
      }
    } else {
      // Absolute import within the project
      const parts = dependency.split(".");
      let resolved = repoPath;

      for (const part of parts) {
        resolved = path.join(resolved, part);
      }

      // Try as Python file
      const pyFile = resolved + ".py";
      if (fs.existsSync(pyFile)) {
        return pyFile;
      }

      // Try as package
      const initFile = path.join(resolved, "__init__.py");
      if (fs.existsSync(initFile)) {
        return initFile;
      }
    }
  }

  return null;
}

function main() {
  const startTime = performance.now();
  const options = parseArguments();

  if (options.help) {
    showHelp();
    return;
  }

  if (!options.repoPath) {
    console.error("Error: Please provide a path to the repository.");
    console.error("Use --help for usage information.");
    process.exit(1);
  }

  if (!fs.existsSync(options.repoPath)) {
    console.error(`Error: Repository path does not exist: ${options.repoPath}`);
    process.exit(1);
  }

  if (!fs.statSync(options.repoPath).isDirectory()) {
    console.error(`Error: Path is not a directory: ${options.repoPath}`);
    process.exit(1);
  }

  log(`Analyzing repository: ${options.repoPath}`, options.verbose);
  log(`Output format: ${options.outputFormat}`, options.verbose, true);
  log(
    `Include external dependencies: ${options.includeExternal}`,
    options.verbose,
    true,
  );

  // Get all files in the repository
  log("Scanning files...", options.verbose, true);
  const allFiles = getFilesInDir(
    options.repoPath,
    options.repoPath,
    [],
    options.verbose,
  );
  log(`Found ${allFiles.length} files to analyze`, options.verbose);

  if (allFiles.length === 0) {
    console.log("No supported files found in the repository.");
    console.log(
      `Supported extensions: ${CONFIG.supportedExtensions.join(", ")}`,
    );
    return;
  }

  // Create node mappings
  const nodes = [];
  const edges = [];
  const fileIdMap = new Map();
  let idCounter = 0;

  // Build nodes
  log("Building dependency graph...", options.verbose, true);
  allFiles.forEach((file) => {
    const relativePath = path.relative(options.repoPath, file);
    if (!fileIdMap.has(relativePath)) {
      fileIdMap.set(relativePath, idCounter);
      nodes.push({
        id: idCounter,
        label: path.basename(relativePath),
        path: relativePath,
        fullPath: file,
        type: path.extname(file).substring(1),
      });
      idCounter++;
    }
  });

  // Build edges by analyzing dependencies
  let totalDependencies = 0;
  allFiles.forEach((file) => {
    const relativePath = path.relative(options.repoPath, file);
    const fromId = fileIdMap.get(relativePath);
    const fileExtension = path.extname(file);
    let dependencies = [];

    if ([".js", ".jsx", ".ts", ".tsx"].includes(fileExtension)) {
      dependencies = getJavaScriptDependencies(file, options.verbose);
    } else if (fileExtension === ".py") {
      dependencies = getPythonDependencies(file, options.verbose);
    }

    log(
      `${relativePath}: ${dependencies.length} dependencies`,
      options.verbose,
      true,
    );

    dependencies.forEach((dep) => {
      const resolvedPath = resolvePath(
        dep,
        file,
        options.repoPath,
        options.includeExternal,
      );
      if (resolvedPath) {
        const resolvedRelativePath = path.relative(
          options.repoPath,
          resolvedPath,
        );

        if (fileIdMap.has(resolvedRelativePath)) {
          const toId = fileIdMap.get(resolvedRelativePath);
          // Avoid self-references and duplicates
          if (fromId !== toId) {
            const existingEdge = edges.find(
              (edge) => edge.from === fromId && edge.to === toId,
            );
            if (!existingEdge) {
              edges.push({ from: fromId, to: toId, dependency: dep });
              totalDependencies++;
            }
          }
        } else if (options.includeExternal) {
          // Add external dependency as a node
          if (!fileIdMap.has(dep)) {
            fileIdMap.set(dep, idCounter);
            nodes.push({
              id: idCounter,
              label: dep,
              path: dep,
              fullPath: dep,
              type: "external",
              external: true,
            });
            edges.push({ from: fromId, to: idCounter, dependency: dep });
            totalDependencies++;
            idCounter++;
          } else {
            const toId = fileIdMap.get(dep);
            if (fromId !== toId) {
              const existingEdge = edges.find(
                (edge) => edge.from === fromId && edge.to === toId,
              );
              if (!existingEdge) {
                edges.push({ from: fromId, to: toId, dependency: dep });
                totalDependencies++;
              }
            }
          }
        }
      }
    });
  });

  log(
    `Analysis complete: ${nodes.length} files, ${totalDependencies} dependencies`,
    options.verbose,
  );

  // Generate output
  const networkData = {
    nodes,
    edges,
    metadata: {
      generatedAt: new Date().toISOString(),
      repository: options.repoPath,
      totalFiles: nodes.length,
      totalDependencies: totalDependencies,
      supportedExtensions: CONFIG.supportedExtensions,
      includesExternal: options.includeExternal,
    },
  };

  // Write output file
  try {
    let output;
    let finalOutputFile = options.outputFile;

    if (options.outputFormat === "js") {
      output = `// Generated dependency graph data\n// Repository: ${options.repoPath}\n// Generated at: ${new Date().toISOString()}\n\nconst networkData = ${JSON.stringify(networkData, null, 2)};`;
      if (!finalOutputFile.endsWith(".js")) {
        finalOutputFile =
          finalOutputFile.replace(/\.[^.]*$/, ".js") || finalOutputFile + ".js";
      }
    } else {
      output = JSON.stringify(networkData, null, 2);
      if (!finalOutputFile.endsWith(".json")) {
        finalOutputFile =
          finalOutputFile.replace(/\.[^.]*$/, ".json") ||
          finalOutputFile + ".json";
      }
    }

    fs.writeFileSync(finalOutputFile, output);

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    console.log(`✅ Analysis complete!`);
    console.log(
      `📊 Results: ${nodes.length} files, ${totalDependencies} dependencies`,
    );
    console.log(`📁 Output: ${finalOutputFile}`);
    console.log(`⏱️  Duration: ${duration}ms`);

    if (!options.verbose && totalDependencies === 0) {
      console.log(`\n💡 No internal dependencies found. This could mean:`);
      console.log(`   • Files don't import each other`);
      console.log(`   • Import patterns aren't recognized`);
      console.log(`   • Try --include-external for external dependencies`);
      console.log(`   • Use --verbose for detailed analysis`);
    }

    console.log(
      `\n🌐 View the graph: Open dependency_graph.html in your browser`,
    );
    console.log(`   Or run: python -m http.server 8000`);
  } catch (error) {
    console.error(`Error writing output file: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getFilesInDir,
  getJavaScriptDependencies,
  getPythonDependencies,
  resolvePath,
  main,
};
