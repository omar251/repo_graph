/**
 * Dependency Analyzer
 * Main analysis orchestrator that coordinates file scanning, parsing, and graph generation
 */

const { FileScanner } = require('../utils/file-scanner');
const { ParserRegistry } = require('../parsers/parser-registry');
const { CacheManager } = require('../utils/cache-manager');
const { InputValidator } = require('../security/input-validator');
const { GraphBuilder } = require('./graph-builder');

class DependencyAnalyzer {
    constructor(config = {}, logger) {
        this.config = config;
        this.logger = logger;
        
        // Initialize components
        this.fileScanner = new FileScanner(config, logger);
        this.parserRegistry = new ParserRegistry(config, logger);
        this.cacheManager = new CacheManager(config.cache, logger);
        this.inputValidator = new InputValidator(config.security, logger);
        this.graphBuilder = new GraphBuilder(config, logger);
        
        this.stats = {
            startTime: null,
            endTime: null,
            filesScanned: 0,
            filesProcessed: 0,
            dependenciesFound: 0,
            errors: []
        };
    }

    async analyze(repositoryPath) {
        this.stats.startTime = Date.now();
        
        try {
            this.logger.info('Starting dependency analysis', { repositoryPath });
            
            // 1. Validate input
            await this.validateInput(repositoryPath);
            
            // 2. Initialize cache
            await this.cacheManager.initialize();
            
            // 3. Check for cached results
            const cacheKey = await this.cacheManager.generateRepoKey(repositoryPath, this.config);
            const cachedResult = await this.cacheManager.get(cacheKey);
            
            if (cachedResult) {
                this.logger.info('Using cached analysis results', { repositoryPath });
                return this.addMetadata(cachedResult);
            }
            
            // 4. Scan for files
            const files = await this.fileScanner.scan(repositoryPath);
            this.stats.filesScanned = files.length;
            
            if (files.length === 0) {
                this.logger.warn('No supported files found', { repositoryPath });
                return this.createEmptyResult();
            }
            
            // 5. Parse files and extract dependencies
            const parseResults = await this.parseFiles(files);
            
            // 6. Build dependency graph
            const graph = await this.graphBuilder.build(parseResults, repositoryPath);
            
            // 7. Cache results
            await this.cacheManager.set(cacheKey, graph);
            
            // 8. Add metadata and return
            const result = this.addMetadata(graph);
            
            this.logger.info('Analysis completed successfully', {
                repositoryPath,
                nodes: result.nodes.length,
                edges: result.edges.length,
                duration: result.metadata.analysisTime
            });
            
            return result;
            
        } catch (error) {
            this.stats.errors.push({
                type: 'fatal',
                message: error.message,
                timestamp: new Date().toISOString()
            });
            
            this.logger.error('Analysis failed', {
                repositoryPath,
                error: error.message,
                stack: error.stack
            });
            
            throw error;
        } finally {
            this.stats.endTime = Date.now();
        }
    }

    async validateInput(repositoryPath) {
        const validation = this.inputValidator.validateRepositoryPath(repositoryPath);
        
        if (!validation.valid) {
            throw new Error(`Invalid repository path: ${validation.errors.join(', ')}`);
        }
        
        // Check if path exists and is accessible
        const fs = require('fs').promises;
        try {
            const stats = await fs.stat(validation.sanitized);
            if (!stats.isDirectory()) {
                throw new Error('Repository path must be a directory');
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error('Repository path does not exist');
            }
            throw new Error(`Cannot access repository path: ${error.message}`);
        }
    }

    async parseFiles(files) {
        const results = [];
        const errors = [];
        
        this.logger.info('Parsing files', { totalFiles: files.length });
        
        // Process files in batches to control memory usage
        const batchSize = this.config.concurrency || 4;
        const batches = this.createBatches(files, batchSize);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            
            this.logger.debug(`Processing batch ${i + 1}/${batches.length}`, {
                batchSize: batch.length
            });
            
            const batchPromises = batch.map(file => this.parseFile(file));
            const batchResults = await Promise.allSettled(batchPromises);
            
            batchResults.forEach((result, index) => {
                const file = batch[index];
                
                if (result.status === 'fulfilled' && result.value) {
                    results.push(result.value);
                    this.stats.filesProcessed++;
                } else {
                    const error = {
                        file: file.path,
                        error: result.reason?.message || 'Unknown error',
                        timestamp: new Date().toISOString()
                    };
                    errors.push(error);
                    this.stats.errors.push(error);
                }
            });
            
            // Progress logging
            if (this.config.logging?.verbose) {
                const processed = (i + 1) * batchSize;
                const total = files.length;
                const percentage = Math.round((processed / total) * 100);
                this.logger.info(`Progress: ${Math.min(processed, total)}/${total} (${percentage}%)`);
            }
        }
        
        this.logger.info('File parsing completed', {
            successful: results.length,
            failed: errors.length,
            totalDependencies: results.reduce((sum, r) => sum + r.dependencies.length, 0)
        });
        
        return results;
    }

    async parseFile(file) {
        try {
            // Check cache first
            const cacheKey = await this.cacheManager.generateFileKey(file.path);
            const cached = await this.cacheManager.get(cacheKey);
            
            if (cached) {
                this.logger.debug('Using cached parse result', { file: file.path });
                return cached;
            }
            
            // Read file content
            const fs = require('fs').promises;
            const content = await fs.readFile(file.path, 'utf8');
            
            // Validate content
            const contentValidation = this.inputValidator.sanitizeFileContent(content, file.path);
            if (!contentValidation.valid) {
                throw new Error(`Invalid file content: ${contentValidation.errors.join(', ')}`);
            }
            
            // Parse with appropriate parser
            const result = await this.parserRegistry.parseFile(file, contentValidation.sanitized);
            
            // Cache the result
            await this.cacheManager.set(cacheKey, result);
            
            this.stats.dependenciesFound += result.dependencies.length;
            
            return result;
            
        } catch (error) {
            this.logger.warn('Failed to parse file', {
                file: file.path,
                error: error.message
            });
            
            // Return empty result instead of throwing
            return {
                file: file,
                dependencies: [],
                metadata: {
                    parser: 'none',
                    error: error.message
                }
            };
        }
    }

    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    createEmptyResult() {
        return {
            nodes: [],
            edges: [],
            metadata: this.generateMetadata()
        };
    }

    addMetadata(result) {
        return {
            ...result,
            metadata: {
                ...result.metadata,
                ...this.generateMetadata()
            }
        };
    }

    generateMetadata() {
        const duration = this.stats.endTime ? this.stats.endTime - this.stats.startTime : 0;
        
        return {
            analysisTime: duration,
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            config: {
                includeExternal: this.config.includeExternal,
                excludePatterns: this.config.excludePatterns,
                includeExtensions: this.config.includeExtensions
            },
            stats: {
                filesScanned: this.stats.filesScanned,
                filesProcessed: this.stats.filesProcessed,
                dependenciesFound: this.stats.dependenciesFound,
                errorCount: this.stats.errors.length
            },
            errors: this.stats.errors,
            cache: this.cacheManager.getStats(),
            parsers: this.parserRegistry.getAvailableParsers()
        };
    }

    // Get analysis statistics
    getStats() {
        return {
            ...this.stats,
            duration: this.stats.endTime ? this.stats.endTime - this.stats.startTime : 0
        };
    }

    // Reset analyzer state
    reset() {
        this.stats = {
            startTime: null,
            endTime: null,
            filesScanned: 0,
            filesProcessed: 0,
            dependenciesFound: 0,
            errors: []
        };
    }
}

module.exports = { DependencyAnalyzer };