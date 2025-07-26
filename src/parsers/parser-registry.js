/**
 * Parser Registry
 * Manages and provides access to all available parsers
 */

const { JavaScriptParser } = require('./javascript-parser');
const { PythonParser } = require('./python-parser');

class ParserRegistry {
    constructor(config = {}, logger) {
        this.config = config;
        this.logger = logger;
        this.parsers = new Map();
        this.extensionMap = new Map();
        
        this.initializeBuiltInParsers();
    }

    initializeBuiltInParsers() {
        // Register built-in parsers
        this.registerParser(new JavaScriptParser(this.config));
        this.registerParser(new PythonParser(this.config));
        
        this.logger?.debug('Built-in parsers initialized', {
            parsers: Array.from(this.parsers.keys()),
            extensions: Array.from(this.extensionMap.keys())
        });
    }

    registerParser(parser) {
        if (!parser.name || !parser.extensions || !Array.isArray(parser.extensions)) {
            throw new Error('Invalid parser: must have name and extensions array');
        }
        
        this.parsers.set(parser.name, parser);
        
        // Map extensions to parser
        for (const ext of parser.extensions) {
            this.extensionMap.set(ext, parser);
        }
        
        this.logger?.debug('Parser registered', {
            name: parser.name,
            extensions: parser.extensions
        });
    }

    getParser(extension) {
        return this.extensionMap.get(extension);
    }

    getParserByName(name) {
        return this.parsers.get(name);
    }

    getSupportedExtensions() {
        return Array.from(this.extensionMap.keys());
    }

    getAvailableParsers() {
        return Array.from(this.parsers.keys());
    }

    isSupported(extension) {
        return this.extensionMap.has(extension);
    }

    async parseFile(file, content) {
        const parser = this.getParser(file.extension);
        
        if (!parser) {
            throw new Error(`No parser available for extension: ${file.extension}`);
        }
        
        try {
            const result = await parser.parse(file, content);
            
            this.logger?.debug('File parsed successfully', {
                file: file.path,
                parser: parser.name,
                dependencies: result.dependencies.length
            });
            
            return result;
        } catch (error) {
            this.logger?.error('Parser failed', {
                file: file.path,
                parser: parser.name,
                error: error.message
            });
            throw error;
        }
    }

    getParserStats() {
        const stats = {};
        
        for (const [name, parser] of this.parsers) {
            stats[name] = {
                extensions: parser.extensions,
                patterns: parser.patterns ? parser.patterns.length : 0,
                metadata: parser.getMetadata ? parser.getMetadata() : {}
            };
        }
        
        return stats;
    }

    // Load external parsers from plugins
    async loadExternalParsers(pluginManager) {
        if (!pluginManager) return;
        
        try {
            const plugins = pluginManager.getLoadedPlugins();
            
            for (const pluginName of plugins) {
                const plugin = pluginManager.getPlugin(pluginName);
                
                if (plugin.parsers && Array.isArray(plugin.parsers)) {
                    for (const parser of plugin.parsers) {
                        this.registerParser(parser);
                    }
                }
            }
            
            this.logger?.info('External parsers loaded', {
                plugins: plugins.length,
                totalParsers: this.parsers.size
            });
            
        } catch (error) {
            this.logger?.error('Failed to load external parsers', {
                error: error.message
            });
        }
    }

    // Validate all registered parsers
    validateParsers() {
        const errors = [];
        
        for (const [name, parser] of this.parsers) {
            try {
                // Check required methods
                if (typeof parser.parse !== 'function') {
                    errors.push(`Parser ${name} missing parse method`);
                }
                
                // Check extensions
                if (!Array.isArray(parser.extensions) || parser.extensions.length === 0) {
                    errors.push(`Parser ${name} has invalid extensions`);
                }
                
                // Check patterns if they exist
                if (parser.patterns && !Array.isArray(parser.patterns)) {
                    errors.push(`Parser ${name} has invalid patterns`);
                }
                
            } catch (error) {
                errors.push(`Parser ${name} validation failed: ${error.message}`);
            }
        }
        
        if (errors.length > 0) {
            throw new Error(`Parser validation failed:\n${errors.join('\n')}`);
        }
        
        this.logger?.debug('All parsers validated successfully');
    }
}

module.exports = { ParserRegistry };