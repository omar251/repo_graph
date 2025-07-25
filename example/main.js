const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// ES6 imports
import { validateInput } from './utils/validator.js';
import { formatOutput } from './utils/formatter.js';
import logger from './utils/logger.js';
import { DatabaseManager } from './database/manager.js';
import { ApiClient } from './api/client.js';

// Local utility imports
const config = require('./config/settings.js');
const { ErrorHandler } = require('./utils/error-handler.js');

class Application {
    constructor(options = {}) {
        this.config = { ...config, ...options };
        this.db = new DatabaseManager(this.config.database);
        this.api = new ApiClient(this.config.api);
        this.errorHandler = new ErrorHandler();
        this.logger = logger;
    }

    async initialize() {
        try {
            this.logger.info('Initializing application...');

            // Validate configuration
            if (!validateInput(this.config)) {
                throw new Error('Invalid configuration provided');
            }

            // Initialize database connection
            await this.db.connect();

            // Initialize API client
            await this.api.initialize();

            this.logger.info('Application initialized successfully');
        } catch (error) {
            this.errorHandler.handle(error);
            throw error;
        }
    }

    async processData(inputData) {
        const startTime = performance.now();

        try {
            this.logger.debug('Processing data...', { inputSize: inputData.length });

            // Validate input
            const validatedData = validateInput(inputData);

            // Process through API
            const apiResult = await this.api.processRequest(validatedData);

            // Store in database
            await this.db.save(apiResult);

            // Format output
            const formattedResult = formatOutput(apiResult);

            const endTime = performance.now();
            this.logger.info('Data processed successfully', {
                duration: endTime - startTime,
                recordsProcessed: formattedResult.length
            });

            return formattedResult;

        } catch (error) {
            this.logger.error('Error processing data', error);
            this.errorHandler.handle(error);
            throw error;
        }
    }

    async shutdown() {
        try {
            this.logger.info('Shutting down application...');

            await this.db.disconnect();
            await this.api.cleanup();

            this.logger.info('Application shutdown complete');
        } catch (error) {
            this.errorHandler.handle(error);
        }
    }
}

// Export for use in other modules
module.exports = Application;

// Example usage
if (require.main === module) {
    const app = new Application({
        database: {
            host: 'localhost',
            port: 5432,
            name: 'example_db'
        },
        api: {
            baseUrl: 'https://api.example.com',
            timeout: 5000
        }
    });

    app.initialize()
        .then(() => {
            console.log('Application started successfully');
        })
        .catch((error) => {
            console.error('Failed to start application:', error.message);
            process.exit(1);
        });
}
