const fs = require('fs');
const path = require('path');

const REPO_PATH = process.argv[2];
if (!REPO_PATH) {
  console.error('Please provide a path to the repository.');
  process.exit(1);
}

const SRC_DIR = REPO_PATH;
const OUTPUT_FILE = path.join(__dirname, 'network-data.json');

function getFilesInDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getFilesInDir(filePath, fileList);
    } else if (path.extname(file) === '.js' || path.extname(file) === '.py') {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function getJavaScriptDependencies(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const dependencies = [];
  const requireRegex = /require\(['"](.+?)['"]\)/g;
  let match;

  while ((match = requireRegex.exec(content)) !== null) {
    dependencies.push(match[1]);
  }
  return dependencies;
}

function getPythonDependencies(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const dependencies = [];
  // Regex for `import module` and `from module import ...`
  const importRegex = /(?:^|\n)(?:import\s+([a-zA-Z0-9_.]+)(?:\s+as\s+\w+)?|from\s+([.a-zA-Z0-9_]+)\s+import)/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const moduleName = match[1] || match[2];
    if (moduleName) {
      dependencies.push(moduleName);
    }
  }
  return dependencies;
}

function resolvePath(dependency, currentFilePath, fileExtension) {
  const currentDir = path.dirname(currentFilePath);
  const srcRoot = SRC_DIR;

  if (fileExtension === '.js') {
    if (dependency.startsWith('./') || dependency.startsWith('../')) {
      return path.resolve(currentDir, dependency);
    }
    return null;
  } else if (fileExtension === '.py') {
    if (dependency.startsWith('.')) {
      let resolved = currentDir;
      let parts = dependency.split('.');
      let dots = 0;
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '') {
          dots++;
        } else {
          break;
        }
      }
      parts = parts.slice(dots);

      for (let i = 0; i < dots - 1; i++) {
        resolved = path.dirname(resolved);
      }

      resolved = path.join(resolved, ...parts);

      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        return path.join(resolved, '__init__.py');
      } else {
        return resolved + '.py';
      }
    } else {
      const possiblePath = path.join(srcRoot, ...dependency.split('.'));
      if (fs.existsSync(possiblePath) && fs.statSync(possiblePath).isDirectory()) {
        return path.join(possiblePath, '__init__.py');
      } else if (fs.existsSync(possiblePath + '.py')) {
        return possiblePath + '.py';
      }
    }
  }
  return null;
}

function main() {
  const allFiles = getFilesInDir(SRC_DIR);
  const nodes = [];
  const edges = [];
  const fileIdMap = new Map();
  let idCounter = 0;

  allFiles.forEach(file => {
    const relativePath = path.relative(SRC_DIR, file);
    if (!fileIdMap.has(relativePath)) {
      fileIdMap.set(relativePath, idCounter);
      nodes.push({ id: idCounter, label: relativePath, path: file });
      idCounter++;
    }
  });

  allFiles.forEach(file => {
    const fromId = fileIdMap.get(path.relative(SRC_DIR, file));
    let dependencies = [];
    const fileExtension = path.extname(file);

    if (fileExtension === '.js') {
      dependencies = getJavaScriptDependencies(file);
    } else if (fileExtension === '.py') {
      dependencies = getPythonDependencies(file);
    }

    dependencies.forEach(dep => {
      const resolvedPath = resolvePath(dep, file, fileExtension);
      if (resolvedPath) {
        let resolvedRelativePath = path.relative(SRC_DIR, resolvedPath);
        
        if (fileExtension === '.js' && !resolvedRelativePath.endsWith('.js')) {
            resolvedRelativePath += '.js';
        } else if (fileExtension === '.py' && !resolvedRelativePath.endsWith('.py')) {
            const initPyPath = path.join(resolvedRelativePath, '__init__.py');
            if (fileIdMap.has(initPyPath)) {
                resolvedRelativePath = initPyPath;
            } else {
                resolvedRelativePath += '.py';
            }
        }

        if (fileIdMap.has(resolvedRelativePath)) {
          const toId = fileIdMap.get(resolvedRelativePath);
          edges.push({ from: fromId, to: toId });
        }
      }
    });
  });

  const networkData = { nodes, edges };
  const output = `const networkData = ${JSON.stringify(networkData, null, 2)};`;
  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Network data written to ${OUTPUT_FILE}`);
}

main();