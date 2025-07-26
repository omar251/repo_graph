#!/usr/bin/env node

/**
 * Main entry point for the Repository Dependency Graph Analyzer
 * Orchestrates the entire analysis process using modular components
 */

const { DependencyAnalyzer } = require('./analyzer/dependency-analyzer');
const { CLIHandler } = require('./cli/cli-handler');
const { ConfigManager } = require('./config/config-manager');
const { Logger } = require('./utils/logger');
const { ErrorHandler } = require('./utils/error-handler');

class Application {
    constructor() {
        this.cliHandler = new CLIHandler();
        this.configManager = new ConfigManager();
        this.logger = null;
        this.errorHandler = null;
        this.analyzer = null;
    }

    async run() {
        try {
            // Parse CLI arguments
            const cliOptions = this.cliHandler.parse(process.argv);
            
            if (cliOptions.help) {
                this.cliHandler.showHelp();
                return;
            }

            // Load configuration
            const config = await this.configManager.loadConfig(
                cliOptions.repositoryPath || process.cwd(),
                cliOptions
            );

            // Initialize components
            this.logger = new Logger(config.logging);
            this.errorHandler = new ErrorHandler(this.logger);
            this.analyzer = new DependencyAnalyzer(config, this.logger);

            // Validate repository path
            if (!config.repositoryPath) {
                throw new Error('Repository path is required');
            }

            this.logger.info('Starting dependency analysis', {
                repository: config.repositoryPath,
                options: config
            });

            // Perform analysis
            const result = await this.analyzer.analyze(config.repositoryPath);

            // Output results
            await this.outputResults(result, config);

            this.logger.info('Analysis completed successfully', {
                nodes: result.nodes.length,
                edges: result.edges.length,
                duration: result.metadata.analysisTime
            });

        } catch (error) {
            if (this.errorHandler) {
                await this.errorHandler.handleFatalError(error);
            } else {
                console.error('Fatal error:', error.message);
            }
            process.exit(1);
        }
    }

    async outputResults(result, config) {
        const { OutputFormatter } = require('./output/output-formatter');
        const formatter = new OutputFormatter(config.output, this.logger);
        
        await formatter.writeResults(result, config.outputFile);
        
        if (!config.quiet) {
            this.showSummary(result, config);
        }
    }

    showSummary(result, config) {
        console.log('\n✅ Analysis complete!');
        console.log(`📊 Results: ${result.nodes.length} files, ${result.edges.length} dependencies`);
        console.log(`📁 Output: ${config.outputFile}`);
        console.log(`⏱️  Duration: ${result.metadata.analysisTime}ms`);
        
        if (result.metadata.errors && result.metadata.errors.length > 0) {
            console.log(`⚠️  Warnings: ${result.metadata.errors.length} files had issues`);
        }
        
        console.log('\n🌐 View the graph: Open dependency_graph.html in your browser');
        console.log('   Or run: python -m http.server 8000');
    }
}

// Export for testing
module.exports = { Application };

// Run if called directly
if (require.main === module) {
    const app = new Application();
    app.run().catch(error => {
        console.error('Application failed:', error.message);
        process.exit(1);
    });
}