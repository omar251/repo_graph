/**
 * JavaScript Parser
 * Handles JavaScript, JSX, and basic TypeScript files
 */

const { BaseParser } = require('./base-parser');

class JavaScriptParser extends BaseParser {
    constructor(config = {}) {
        super(config);
        this.extensions = ['.js', '.jsx', '.mjs', '.cjs'];
        this.name = 'JavaScriptParser';
        
        this.patterns = [
            // ES6 import statements
            {
                regex: /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g,
                moduleGroup: 1,
                type: 'import',
                transform: (dep, match) => {
                    dep.importType = this.getImportType(match[0]);
                }
            },
            
            // CommonJS require
            {
                regex: /require\(['"`]([^'"`]+)['"`]\)/g,
                moduleGroup: 1,
                type: 'require'
            },
            
            // Dynamic imports
            {
                regex: /import\(['"`]([^'"`]+)['"`]\)/g,
                moduleGroup: 1,
                type: 'dynamic-import'
            },
            
            // AMD require
            {
                regex: /require\(\s*\[([^\]]*)\]/g,
                moduleGroup: 1,
                type: 'amd-require',
                transform: (dep, match) => {
                    // Parse array of dependencies
                    const deps = match[1].split(',').map(d => d.trim().replace(/['"`]/g, ''));
                    dep.modules = deps;
                    dep.module = deps[0]; // Use first for compatibility
                }
            },
            
            // System.import (SystemJS)
            {
                regex: /System\.import\(['"`]([^'"`]+)['"`]\)/g,
                moduleGroup: 1,
                type: 'system-import'
            }
        ];
    }

    async parse(file, content) {
        try {
            // Remove comments to avoid false positives
            const cleanContent = this.removeComments(content);
            
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
                    localDependencies: resolvedDependencies.filter(d => d.type === 'local').length
                }
            };
            
        } catch (error) {
            throw new Error(`JavaScript parsing failed for ${file.path}: ${error.message}`);
        }
    }

    getImportType(importStatement) {
        if (importStatement.includes('import {')) return 'named';
        if (importStatement.includes('import *')) return 'namespace';
        if (importStatement.includes('import ') && importStatement.includes(' from ')) return 'default';
        if (importStatement.includes("import '") || importStatement.includes('import "')) return 'side-effect';
        return 'unknown';
    }

    // Override to handle JSX and some TypeScript patterns
    removeComments(content) {
        let result = content;
        
        // Remove JSX comments {/* */}
        result = result.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
        
        // Remove regular JS comments
        result = super.removeComments(result);
        
        return result;
    }

    // Enhanced validation for JavaScript
    isValidDependency(dependency) {
        if (!super.isValidDependency(dependency)) {
            return false;
        }
        
        // Skip template literals (they should be handled separately)
        if (dependency.module.includes('${')) {
            return false;
        }
        
        // Skip data URLs
        if (dependency.module.startsWith('data:')) {
            return false;
        }
        
        // Skip URLs
        if (dependency.module.startsWith('http://') || dependency.module.startsWith('https://')) {
            return false;
        }
        
        return true;
    }

    // Resolve module paths with Node.js resolution algorithm
    resolveModulePath(modulePath, currentFile) {
        const baseResolution = super.resolveModulePath(modulePath, currentFile);
        
        if (baseResolution.type === 'external') {
            // Handle scoped packages
            if (modulePath.startsWith('@')) {
                baseResolution.scope = modulePath.split('/')[0];
                baseResolution.package = modulePath.split('/').slice(0, 2).join('/');
            } else {
                baseResolution.package = modulePath.split('/')[0];
            }
        }
        
        return baseResolution;
    }

    // Extract exports for dependency graph
    extractExports(content) {
        const exports = [];
        const exportPatterns = [
            /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g,
            /export\s*\{\s*([^}]+)\s*\}/g,
            /module\.exports\s*=\s*(\w+)/g,
            /exports\.(\w+)\s*=/g
        ];
        
        for (const pattern of exportPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                exports.push({
                    name: match[1],
                    line: this.getLineNumber(content, match.index),
                    type: match[0].includes('default') ? 'default' : 'named'
                });
            }
        }
        
        return exports;
    }
}

module.exports = { JavaScriptParser };