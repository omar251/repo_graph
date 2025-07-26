/**
 * Error Handler
 * Provides robust error handling with retry logic and context enhancement
 */

class ErrorHandler {
    constructor(logger) {
        this.logger = logger;
        this.errorCounts = new Map();
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.circuitBreakers = new Map();
    }

    async handleWithRetry(operation, context = {}) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (attempt < this.maxRetries && this.isRetryable(error)) {
                    await this.logger.warn(`Operation failed, retrying (${attempt}/${this.maxRetries})`, {
                        error: error.message,
                        context,
                        attempt
                    });
                    
                    await this.delay(this.retryDelay * attempt);
                    continue;
                }
                
                break;
            }
        }
        
        throw this.enhanceError(lastError, context);
    }

    isRetryable(error) {
        // File system errors that might be temporary
        const retryableCodes = ['ENOENT', 'EACCES', 'EMFILE', 'ENFILE', 'EAGAIN', 'EBUSY'];
        const retryableMessages = ['timeout', 'network', 'connection'];
        
        return retryableCodes.includes(error.code) ||
               retryableMessages.some(msg => error.message.toLowerCase().includes(msg));
    }

    enhanceError(error, context = {}) {
        const enhancedError = new Error(error.message);
        enhancedError.name = error.name;
        enhancedError.code = error.code;
        enhancedError.stack = error.stack;
        enhancedError.context = context;
        enhancedError.timestamp = new Date().toISOString();
        enhancedError.pid = process.pid;
        
        // Track error frequency
        const errorKey = `${error.name}:${error.code || 'unknown'}`;
        this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
        
        return enhancedError;
    }

    async handleFileError(error, filePath) {
        const context = { filePath, operation: 'file_processing' };
        
        switch (error.code) {
            case 'ENOENT':
                await this.logger.warn('File not found, skipping', context);
                return { skipped: true, reason: 'File not found' };
                
            case 'EACCES':
                await this.logger.warn('Permission denied, skipping', context);
                return { skipped: true, reason: 'Permission denied' };
                
            case 'EISDIR':
                await this.logger.debug('Path is directory, skipping', context);
                return { skipped: true, reason: 'Is directory' };
                
            case 'EMFILE':
            case 'ENFILE':
                await this.logger.error('Too many open files', context);
                throw this.enhanceError(error, context);
                
            case 'ENOTDIR':
                await this.logger.warn('Not a directory, skipping', context);
                return { skipped: true, reason: 'Not a directory' };
                
            default:
                await this.logger.error('Unexpected file error', { 
                    ...context, 
                    error: error.message,
                    code: error.code 
                });
                throw this.enhanceError(error, context);
        }
    }

    async handleParseError(error, filePath, content) {
        const context = { 
            filePath, 
            operation: 'parsing',
            contentLength: content?.length || 0,
            fileExtension: require('path').extname(filePath)
        };
        
        if (error.name === 'SyntaxError') {
            await this.logger.warn('Syntax error in file, skipping', {
                ...context,
                line: error.lineNumber,
                column: error.columnNumber,
                syntaxError: error.message
            });
            return { 
                dependencies: [], 
                errors: [{ 
                    type: 'syntax', 
                    message: error.message,
                    line: error.lineNumber,
                    column: error.columnNumber
                }] 
            };
        }
        
        if (error.message.includes('Invalid or unexpected token')) {
            await this.logger.warn('Invalid token in file, possibly binary or corrupted', context);
            return { 
                dependencies: [], 
                errors: [{ 
                    type: 'invalid_token', 
                    message: 'File contains invalid tokens'
                }] 
            };
        }
        
        await this.logger.error('Parse error', { ...context, error: error.message });
        throw this.enhanceError(error, context);
    }

    async handleNetworkError(error, url, context = {}) {
        const networkContext = { 
            url, 
            operation: 'network_request',
            ...context 
        };
        
        if (error.code === 'ENOTFOUND') {
            await this.logger.error('DNS resolution failed', networkContext);
        } else if (error.code === 'ECONNREFUSED') {
            await this.logger.error('Connection refused', networkContext);
        } else if (error.code === 'ETIMEDOUT') {
            await this.logger.error('Request timeout', networkContext);
        } else {
            await this.logger.error('Network error', { 
                ...networkContext, 
                error: error.message 
            });
        }
        
        throw this.enhanceError(error, networkContext);
    }

    async handleFatalError(error) {
        const context = { 
            operation: 'application',
            fatal: true 
        };
        
        await this.logger.error('Fatal application error', {
            ...context,
            error: error.message,
            stack: error.stack
        });
        
        // Log error summary before exit
        const summary = this.getErrorSummary();
        if (Object.keys(summary).length > 0) {
            await this.logger.error('Error summary', { summary });
        }
    }

    // Circuit breaker pattern for repeated failures
    async executeWithCircuitBreaker(key, operation, options = {}) {
        const breaker = this.getCircuitBreaker(key, options);
        
        if (breaker.state === 'OPEN') {
            if (Date.now() - breaker.lastFailureTime > breaker.resetTimeout) {
                breaker.state = 'HALF_OPEN';
                breaker.successCount = 0;
            } else {
                throw new Error(`Circuit breaker is OPEN for ${key}`);
            }
        }

        try {
            const result = await operation();
            this.onCircuitBreakerSuccess(breaker);
            return result;
        } catch (error) {
            this.onCircuitBreakerFailure(breaker);
            throw error;
        }
    }

    getCircuitBreaker(key, options = {}) {
        if (!this.circuitBreakers.has(key)) {
            this.circuitBreakers.set(key, {
                state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
                failureCount: 0,
                successCount: 0,
                lastFailureTime: null,
                failureThreshold: options.failureThreshold || 5,
                resetTimeout: options.resetTimeout || 60000
            });
        }
        return this.circuitBreakers.get(key);
    }

    onCircuitBreakerSuccess(breaker) {
        breaker.failureCount = 0;
        
        if (breaker.state === 'HALF_OPEN') {
            breaker.successCount++;
            if (breaker.successCount >= 3) {
                breaker.state = 'CLOSED';
            }
        }
    }

    onCircuitBreakerFailure(breaker) {
        breaker.failureCount++;
        breaker.lastFailureTime = Date.now();
        
        if (breaker.failureCount >= breaker.failureThreshold) {
            breaker.state = 'OPEN';
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getErrorSummary() {
        const summary = {};
        for (const [errorType, count] of this.errorCounts) {
            summary[errorType] = count;
        }
        return summary;
    }

    getCircuitBreakerStatus() {
        const status = {};
        for (const [key, breaker] of this.circuitBreakers) {
            status[key] = {
                state: breaker.state,
                failureCount: breaker.failureCount,
                lastFailureTime: breaker.lastFailureTime
            };
        }
        return status;
    }

    reset() {
        this.errorCounts.clear();
        this.circuitBreakers.clear();
    }
}

module.exports = { ErrorHandler };