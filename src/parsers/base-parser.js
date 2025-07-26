/**
 * Base Parser
 * Abstract base class for all language-specific parsers
 */

const path = require('path');

class BaseParser {
    constructor(config = {}) {
        this.config = config;
        this.extensions = [];
        this.patterns = [];
        this.name = this.constructor.name;
    }

    async parse(file, content) {
        throw new Error('parse() must be implemented by subclass');
    }

    extractDependencies(content) {
        const dependencies = [];
        
        for (const pattern of this.patterns) {
            // Reset regex lastIndex to ensure proper matching
            pattern.regex.lastIndex = 0;
            
            let match;
            while ((match = pattern.regex.exec(content)) !== null) {
                const dependency = {
                    module: match[pattern.moduleGroup],
                    line: this.getLineNumber(content, match.index),
                    column: this.getColumnNumber(content, match.index),
                    type: pattern.type,
                    raw: match[0],
                    startIndex: match.index,
                    endIndex: match.index + match[0].length
                };
                
                // Apply pattern-specific transformations
                if (pattern.transform) {
                    pattern.transform(dependency, match);
                }
                
                // Validate the dependency
                if (this.isValidDependency(dependency)) {
                    dependencies.push(dependency);
                }
            }
        }
        
        return this.deduplicateDependencies(dependencies);
    }

    isValidDependency(dependency) {
        // Basic validation
        if (!dependency.module || typeof dependency.module !== 'string') {
            return false;
        }
        
        // Skip empty or whitespace-only modules
        if (dependency.module.trim().length === 0) {
            return false;
        }
        
        // Skip obviously invalid paths
        if (dependency.module.includes('\n') || dependency.module.includes('\r')) {
            return false;
        }
        
        return true;
    }

    deduplicateDependencies(dependencies) {
        const seen = new Set();
        const unique = [];
        
        for (const dep of dependencies) {
            const key = `${dep.module}:${dep.type}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(dep);
            }
        }
        
        return unique;
    }

    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }

    getColumnNumber(content, index) {
        const lines = content.substring(0, index).split('\n');
        return lines[lines.length - 1].length + 1;
    }

    isExternalDependency(modulePath) {
        // External dependencies don't start with . or /
        return !modulePath.startsWith('.') && !modulePath.startsWith('/');
    }

    resolveModulePath(modulePath, currentFile) {
        if (this.isExternalDependency(modulePath)) {
            return { 
                type: 'external', 
                path: modulePath,
                resolved: modulePath
            };
        }
        
        const basePath = path.dirname(currentFile);
        let resolved;
        
        try {
            resolved = path.resolve(basePath, modulePath);
        } catch (error) {
            return {
                type: 'unresolved',
                path: modulePath,
                resolved: null,
                error: error.message
            };
        }
        
        return { 
            type: 'local', 
            path: modulePath,
            resolved: resolved
        };
    }

    // Attempt to resolve file extensions
    async resolveFileWithExtensions(basePath, modulePath) {
        const possibleExtensions = this.extensions.concat(['', '.js', '.json', '.ts', '.tsx']);
        
        for (const ext of possibleExtensions) {
            const fullPath = modulePath + ext;
            const resolved = path.resolve(basePath, fullPath);
            
            try {
                const fs = require('fs').promises;
                await fs.access(resolved);
                return resolved;
            } catch {
                continue;
            }
        }
        
        return null;
    }

    // Extract comments from content (useful for some parsers)
    extractComments(content) {
        const comments = [];
        
        // Single line comments
        const singleLineRegex = /\/\/.*$/gm;
        let match;
        while ((match = singleLineRegex.exec(content)) !== null) {
            comments.push({
                type: 'single',
                content: match[0],
                line: this.getLineNumber(content, match.index)
            });
        }
        
        // Multi-line comments
        const multiLineRegex = /\/\*[\s\S]*?\*\//g;
        while ((match = multiLineRegex.exec(content)) !== null) {
            comments.push({
                type: 'multi',
                content: match[0],
                startLine: this.getLineNumber(content, match.index),
                endLine: this.getLineNumber(content, match.index + match[0].length)
            });
        }
        
        return comments;
    }

    // Remove comments from content (useful for cleaner parsing)
    removeComments(content) {
        return content
            .replace(/\/\*[\s\S]*?\*\//g, '') // Multi-line comments
            .replace(/\/\/.*$/gm, ''); // Single-line comments
    }

    // Check if a position is inside a string literal
    isInsideString(content, position) {
        const beforePosition = content.substring(0, position);
        
        // Count unescaped quotes
        let singleQuotes = 0;
        let doubleQuotes = 0;
        let backticks = 0;
        
        for (let i = 0; i < beforePosition.length; i++) {
            const char = beforePosition[i];
            const prevChar = i > 0 ? beforePosition[i - 1] : '';
            
            if (char === "'" && prevChar !== '\\') singleQuotes++;
            if (char === '"' && prevChar !== '\\') doubleQuotes++;
            if (char === '`' && prevChar !== '\\') backticks++;
        }
        
        return (singleQuotes % 2 === 1) || (doubleQuotes % 2 === 1) || (backticks % 2 === 1);
    }

    // Get parser metadata
    getMetadata() {
        return {
            name: this.name,
            extensions: this.extensions,
            patterns: this.patterns.length,
            version: '1.0.0'
        };
    }
}

module.exports = { BaseParser };