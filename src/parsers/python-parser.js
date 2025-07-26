/**
 * Python Parser
 * Handles Python import statements and dependencies
 */

const { BaseParser } = require('./base-parser');

class PythonParser extends BaseParser {
    constructor(config = {}) {
        super(config);
        this.extensions = ['.py', '.pyw'];
        this.name = 'PythonParser';
        
        this.patterns = [
            // Standard imports: import module
            {
                regex: /^import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/gm,
                moduleGroup: 1,
                type: 'import'
            },
            
            // From imports: from module import something
            {
                regex: /^from\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+import/gm,
                moduleGroup: 1,
                type: 'from-import'
            },
            
            // Relative imports: from .module import something
            {
                regex: /^from\s+(\.+[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+import/gm,
                moduleGroup: 1,
                type: 'relative-import'
            },
            
            // Relative imports without module: from . import something
            {
                regex: /^from\s+(\.+)\s+import/gm,
                moduleGroup: 1,
                type: 'relative-import'
            },
            
            // Dynamic imports: __import__('module')
            {
                regex: /__import__\(['"]([^'"]+)['"]\)/g,
                moduleGroup: 1,
                type: 'dynamic-import'
            },
            
            // importlib.import_module
            {
                regex: /importlib\.import_module\(['"]([^'"]+)['"]\)/g,
                moduleGroup: 1,
                type: 'importlib'
            }
        ];
    }

    async parse(file, content) {
        try {
            // Remove comments and docstrings
            const cleanContent = this.removeCommentsAndDocstrings(content);
            
            // Extract dependencies
            const dependencies = this.extractDependencies(cleanContent);
            
            // Resolve paths and add metadata
            const resolvedDependencies = dependencies.map(dep => {
                const resolved = this.resolveModulePath(dep.module, file.path);
                return {
                    ...dep,
                    ...resolved,
                    parser: this.name
                };
            });
            
            return {
                file: file,
                dependencies: resolvedDependencies,
                metadata: {
                    parser: this.name,
                    totalDependencies: resolvedDependencies.length,
                    externalDependencies: resolvedDependencies.filter(d => d.type === 'external').length,
                    localDependencies: resolvedDependencies.filter(d => d.type === 'local').length,
                    relativeImports: resolvedDependencies.filter(d => d.type === 'relative-import').length
                }
            };
            
        } catch (error) {
            throw new Error(`Python parsing failed for ${file.path}: ${error.message}`);
        }
    }

    removeCommentsAndDocstrings(content) {
        let result = content;
        
        // Remove single-line comments
        result = result.replace(/^\s*#.*$/gm, '');
        
        // Remove triple-quoted docstrings (both ''' and """)
        result = result.replace(/'''[\s\S]*?'''/g, '');
        result = result.replace(/"""[\s\S]*?"""/g, '');
        
        return result;
    }

    isValidDependency(dependency) {
        if (!super.isValidDependency(dependency)) {
            return false;
        }
        
        // Skip invalid Python module names
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(dependency.module.replace(/^\.+/, ''))) {
            return false;
        }
        
        return true;
    }

    resolveModulePath(modulePath, currentFile) {
        const path = require('path');
        
        // Handle relative imports
        if (modulePath.startsWith('.')) {
            const basePath = path.dirname(currentFile);
            const levels = modulePath.match(/^\.+/)[0].length;
            
            let targetPath = basePath;
            for (let i = 1; i < levels; i++) {
                targetPath = path.dirname(targetPath);
            }
            
            const moduleName = modulePath.replace(/^\.+/, '');
            if (moduleName) {
                const resolved = path.join(targetPath, moduleName.replace(/\./g, path.sep));
                return {
                    type: 'local',
                    path: modulePath,
                    resolved: resolved + '.py'
                };
            } else {
                return {
                    type: 'local',
                    path: modulePath,
                    resolved: targetPath
                };
            }
        }
        
        // Handle absolute imports
        if (this.isStandardLibrary(modulePath)) {
            return {
                type: 'standard',
                path: modulePath,
                resolved: modulePath
            };
        }
        
        // Check if it's a local module
        if (this.isLocalModule(modulePath, currentFile)) {
            const basePath = this.findProjectRoot(currentFile);
            const resolved = path.join(basePath, modulePath.replace(/\./g, path.sep));
            return {
                type: 'local',
                path: modulePath,
                resolved: resolved + '.py'
            };
        }
        
        // External package
        return {
            type: 'external',
            path: modulePath,
            resolved: modulePath,
            package: modulePath.split('.')[0]
        };
    }

    isStandardLibrary(moduleName) {
        // Common Python standard library modules
        const stdLibModules = new Set([
            'os', 'sys', 'json', 'datetime', 'time', 'math', 'random', 'collections',
            'itertools', 'functools', 'operator', 're', 'string', 'io', 'pathlib',
            'urllib', 'http', 'email', 'html', 'xml', 'csv', 'configparser',
            'logging', 'unittest', 'doctest', 'argparse', 'subprocess', 'threading',
            'multiprocessing', 'asyncio', 'socket', 'ssl', 'hashlib', 'hmac',
            'secrets', 'sqlite3', 'pickle', 'copyreg', 'copy', 'pprint', 'reprlib',
            'enum', 'numbers', 'cmath', 'decimal', 'fractions', 'statistics',
            'array', 'weakref', 'types', 'gc', 'inspect', 'site', 'importlib',
            'pkgutil', 'modulefinder', 'runpy', 'ast', 'symtable', 'symbol',
            'token', 'keyword', 'tokenize', 'tabnanny', 'pyclbr', 'py_compile',
            'compileall', 'dis', 'pickletools', 'platform', 'errno', 'ctypes'
        ]);
        
        const topLevel = moduleName.split('.')[0];
        return stdLibModules.has(topLevel);
    }

    isLocalModule(moduleName, currentFile) {
        const fs = require('fs');
        const path = require('path');
        
        try {
            const basePath = this.findProjectRoot(currentFile);
            const modulePath = path.join(basePath, moduleName.replace(/\./g, path.sep) + '.py');
            return fs.existsSync(modulePath);
        } catch {
            return false;
        }
    }

    findProjectRoot(currentFile) {
        const path = require('path');
        const fs = require('fs');
        
        let dir = path.dirname(currentFile);
        
        while (dir !== path.dirname(dir)) {
            // Look for common Python project indicators
            const indicators = ['setup.py', 'pyproject.toml', 'requirements.txt', '.git'];
            
            for (const indicator of indicators) {
                if (fs.existsSync(path.join(dir, indicator))) {
                    return dir;
                }
            }
            
            dir = path.dirname(dir);
        }
        
        return path.dirname(currentFile);
    }

    // Extract function and class definitions
    extractDefinitions(content) {
        const definitions = [];
        
        // Function definitions
        const funcPattern = /^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm;
        let match;
        while ((match = funcPattern.exec(content)) !== null) {
            definitions.push({
                type: 'function',
                name: match[1],
                line: this.getLineNumber(content, match.index)
            });
        }
        
        // Class definitions
        const classPattern = /^class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[\(:]?/gm;
        while ((match = classPattern.exec(content)) !== null) {
            definitions.push({
                type: 'class',
                name: match[1],
                line: this.getLineNumber(content, match.index)
            });
        }
        
        return definitions;
    }

    // Check if import is inside a function or conditional
    isConditionalImport(content, importIndex) {
        const beforeImport = content.substring(0, importIndex);
        const lines = beforeImport.split('\n');
        
        // Check indentation of the import line
        const importLine = content.substring(importIndex).split('\n')[0];
        const indentation = importLine.match(/^\s*/)[0].length;
        
        return indentation > 0;
    }
}

module.exports = { PythonParser };