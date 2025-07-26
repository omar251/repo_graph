/**
 * Configuration Manager
 * Handles loading and merging configuration from multiple sources
 */

const fs = require('fs').promises;
const path = require('path');

class ConfigManager {
    constructor() {
        this.defaultConfig = {
            // File scanning
            maxFileSize: 1024 * 1024, // 1MB
            excludePatterns: [
                'node_modules/**',
                '.git/**',
                'dist/**',
                'build/**',
                '**/*.min.js',
                'coverage/**',
                '.nyc_output/**'
            ],
            includeExtensions: ['.js', '.jsx', '.ts', '.tsx', '.py'],
            
            // Analysis options
            includeExternal: false,
            followSymlinks: false,
            maxDepth: 50,
            
            // Output options
            outputFormat: 'json',
            outputFile: 'network-data.json',
            prettify: true,
            
            // Performance
            concurrency: Math.min(4, require('os').cpus().length),
            timeout: 30000,
            
            // Caching
            cache: {
                enabled: true,
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                maxSize: 100 * 1024 * 1024 // 100MB
            },
            
            // Logging
            logging: {
                level: 'info',
                verbose: false,
                logFile: null,
                colors: true
            },
            
            // Security
            security: {
                maxPathLength: 4096,
                allowedExtensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.json'],
                blockedPaths: ['/etc', '/proc', '/sys', '/dev', '/root']
            }
        };
        
        this.configFiles = [
            '.depgraphrc',
            '.depgraphrc.json',
            '.depgraphrc.js',
            'depgraph.config.js',
            'package.json' // depgraph section
        ];
    }

    async loadConfig(projectPath = process.cwd(), cliOptions = {}) {
        let config = { ...this.defaultConfig };
        
        // 1. Load from config files
        const fileConfig = await this.loadFromFiles(projectPath);
        config = this.mergeConfig(config, fileConfig);
        
        // 2. Load from environment variables
        const envConfig = this.loadFromEnvironment();
        config = this.mergeConfig(config, envConfig);
        
        // 3. Apply CLI overrides
        config = this.mergeConfig(config, this.transformCliOptions(cliOptions));
        
        // 4. Set repository path
        config.repositoryPath = cliOptions.repositoryPath || projectPath;
        
        // 5. Validate configuration
        this.validateConfig(config);
        
        return config;
    }

    async loadFromFiles(projectPath) {
        for (const configFile of this.configFiles) {
            const configPath = path.join(projectPath, configFile);
            
            try {
                await fs.access(configPath);
                
                if (configFile.endsWith('.json') || configFile === '.depgraphrc') {
                    const content = await fs.readFile(configPath, 'utf8');
                    return JSON.parse(content);
                }
                
                if (configFile.endsWith('.js')) {
                    // Clear require cache to allow reloading
                    delete require.cache[require.resolve(configPath)];
                    return require(configPath);
                }
                
                if (configFile === 'package.json') {
                    const content = await fs.readFile(configPath, 'utf8');
                    const pkg = JSON.parse(content);
                    return pkg.depgraph || {};
                }
                
            } catch (error) {
                // Config file doesn't exist or is invalid, continue
                continue;
            }
        }
        
        return {};
    }

    loadFromEnvironment() {
        const envConfig = {};
        const envPrefix = 'DEPGRAPH_';
        
        Object.keys(process.env).forEach(key => {
            if (key.startsWith(envPrefix)) {
                const configKey = this.envKeyToConfigKey(key.slice(envPrefix.length));
                let value = process.env[key];
                
                // Try to parse as JSON for complex values
                try {
                    value = JSON.parse(value);
                } catch {
                    // Keep as string if not valid JSON
                    if (value === 'true') value = true;
                    if (value === 'false') value = false;
                    if (!isNaN(value) && value !== '') value = Number(value);
                }
                
                this.setNestedProperty(envConfig, configKey, value);
            }
        });
        
        return envConfig;
    }

    transformCliOptions(cliOptions) {
        const transformed = {};
        
        // Map CLI options to config structure
        if (cliOptions.verbose !== undefined) {
            transformed.logging = { verbose: cliOptions.verbose };
        }
        
        if (cliOptions.quiet !== undefined) {
            transformed.quiet = cliOptions.quiet;
        }
        
        if (cliOptions.includeExternal !== undefined) {
            transformed.includeExternal = cliOptions.includeExternal;
        }
        
        if (cliOptions.output !== undefined) {
            transformed.outputFile = cliOptions.output;
        }
        
        if (cliOptions.format !== undefined) {
            transformed.outputFormat = cliOptions.format;
        }
        
        if (cliOptions.excludePatterns && cliOptions.excludePatterns.length > 0) {
            transformed.excludePatterns = cliOptions.excludePatterns;
        }
        
        if (cliOptions.maxFileSize !== undefined) {
            transformed.maxFileSize = cliOptions.maxFileSize;
        }
        
        if (cliOptions.cache !== undefined) {
            transformed.cache = { enabled: cliOptions.cache };
        }
        
        return transformed;
    }

    mergeConfig(base, override) {
        const result = { ...base };
        
        for (const [key, value] of Object.entries(override)) {
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.mergeConfig(result[key] || {}, value);
            } else {
                result[key] = value;
            }
        }
        
        return result;
    }

    validateConfig(config) {
        const errors = [];
        
        if (config.maxFileSize < 0 || config.maxFileSize > 100 * 1024 * 1024) {
            errors.push('maxFileSize must be between 0 and 100MB');
        }
        
        if (config.concurrency < 1 || config.concurrency > 20) {
            errors.push('concurrency must be between 1 and 20');
        }
        
        if (!['json', 'js'].includes(config.outputFormat)) {
            errors.push('outputFormat must be "json" or "js"');
        }
        
        if (!Array.isArray(config.excludePatterns)) {
            errors.push('excludePatterns must be an array');
        }
        
        if (!Array.isArray(config.includeExtensions)) {
            errors.push('includeExtensions must be an array');
        }
        
        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }
    }

    envKeyToConfigKey(envKey) {
        return envKey.toLowerCase().replace(/_/g, '.');
    }

    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    // Generate example config file
    generateConfigFile(format = 'json') {
        const exampleConfig = {
            maxFileSize: 1048576,
            excludePatterns: [
                "node_modules/**",
                ".git/**",
                "dist/**",
                "build/**"
            ],
            includeExternal: false,
            outputFormat: "json",
            cache: {
                enabled: true,
                maxAge: 86400000
            },
            logging: {
                level: "info",
                verbose: false
            }
        };

        if (format === 'json') {
            return JSON.stringify(exampleConfig, null, 2);
        }
        
        return `module.exports = ${JSON.stringify(exampleConfig, null, 2)};`;
    }
}

module.exports = { ConfigManager };