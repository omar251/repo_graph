/**
 * Comprehensive error handling utility
 * Provides error classification, handling strategies, and integration with logging
 */

// Import logger for error reporting
const logger = require('./logger.js');

/**
 * Base error class with enhanced features
 */
class BaseError extends Error {
    constructor(message, options = {}) {
        super(message);

        this.name = this.constructor.name;
        this.timestamp = new Date();
        this.severity = options.severity || 'medium';
        this.code = options.code || 'UNKNOWN_ERROR';
        this.context = options.context || {};
        this.recoverable = options.recoverable !== false;
        this.statusCode = options.statusCode || 500;

        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Converts error to JSON format
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            severity: this.severity,
            timestamp: this.timestamp,
            context: this.context,
            recoverable: this.recoverable,
            statusCode: this.statusCode,
            stack: this.stack
        };
    }

    /**
     * Creates a user-friendly error message
     */
    getUserMessage() {
        // Override in subclasses for specific user messages
        return this.recoverable ?
            'An error occurred, but you can try again.' :
            'A serious error occurred. Please contact support.';
    }
}

/**
 * Validation error class
 */
class ValidationError extends BaseError {
    constructor(message, field = null, value = null) {
        super(message, {
            severity: 'low',
            code: 'VALIDATION_ERROR',
            statusCode: 400,
            recoverable: true,
            context: { field, value }
        });
    }

    getUserMessage() {
        return `Please check your input: ${this.message}`;
    }
}

/**
 * Database error class
 */
class DatabaseError extends BaseError {
    constructor(message, query = null, operation = null) {
        super(message, {
            severity: 'high',
            code: 'DATABASE_ERROR',
            statusCode: 500,
            recoverable: false,
            context: { query, operation }
        });
    }

    getUserMessage() {
        return 'A database error occurred. Our team has been notified.';
    }
}

/**
 * API error class
 */
class ApiError extends BaseError {
    constructor(message, endpoint = null, responseCode = null) {
        super(message, {
            severity: 'medium',
            code: 'API_ERROR',
            statusCode: responseCode || 502,
            recoverable: true,
            context: { endpoint, responseCode }
        });
    }

    getUserMessage() {
        return 'External service is temporarily unavailable. Please try again later.';
    }
}

/**
 * Authentication error class
 */
class AuthenticationError extends BaseError {
    constructor(message, userId = null) {
        super(message, {
            severity: 'medium',
            code: 'AUTH_ERROR',
            statusCode: 401,
            recoverable: true,
            context: { userId }
        });
    }

    getUserMessage() {
        return 'Authentication failed. Please check your credentials.';
    }
}

/**
 * Authorization error class
 */
class AuthorizationError extends BaseError {
    constructor(message, resource = null, action = null) {
        super(message, {
            severity: 'medium',
            code: 'AUTHZ_ERROR',
            statusCode: 403,
            recoverable: false,
            context: { resource, action }
        });
    }

    getUserMessage() {
        return 'You do not have permission to perform this action.';
    }
}

/**
 * Network error class
 */
class NetworkError extends BaseError {
    constructor(message, url = null, timeout = false) {
        super(message, {
            severity: 'medium',
            code: 'NETWORK_ERROR',
            statusCode: 503,
            recoverable: true,
            context: { url, timeout }
        });
    }

    getUserMessage() {
        return 'Network connection failed. Please check your internet connection.';
    }
}

/**
 * Configuration error class
 */
class ConfigurationError extends BaseError {
    constructor(message, configKey = null) {
        super(message, {
            severity: 'high',
            code: 'CONFIG_ERROR',
            statusCode: 500,
            recoverable: false,
            context: { configKey }
        });
    }

    getUserMessage() {
        return 'Application configuration error. Please contact support.';
    }
}

/**
 * Main error handler class
 */
class ErrorHandler {
    constructor(options = {}) {
        this.options = {
            enableLogging: true,
            enableNotifications: false,
            maxStackTrace: 10,
            enableRecovery: true,
            notificationThreshold: 'high',
            ...options
        };

        this.errorCounts = new Map();
        this.recentErrors = [];
        this.maxRecentErrors = 100;

        // Bind methods to preserve context
        this.handle = this.handle.bind(this);
        this.handleAsync = this.handleAsync.bind(this);
    }

    /**
     * Main error handling method
     */
    handle(error, context = {}) {
        try {
            // Ensure error is an Error instance
            const processedError = this.normalizeError(error);

            // Add handling context
            processedError.handledAt = new Date();
            processedError.handlerContext = context;

            // Track error statistics
            this.trackError(processedError);

            // Log the error
            if (this.options.enableLogging) {
                this.logError(processedError);
            }

            // Send notifications if needed
            if (this.options.enableNotifications) {
                this.notifyError(processedError);
            }

            // Attempt recovery if applicable
            if (this.options.enableRecovery && processedError.recoverable) {
                this.attemptRecovery(processedError);
            }

            return processedError;

        } catch (handlingError) {
            // If error handling itself fails, log and return original error
            console.error('Error handler failed:', handlingError);
            return error;
        }
    }

    /**
     * Async error handling wrapper
     */
    async handleAsync(asyncFunction, context = {}) {
        try {
            return await asyncFunction();
        } catch (error) {
            throw this.handle(error, context);
        }
    }

    /**
     * Normalizes different error types to BaseError instances
     */
    normalizeError(error) {
        if (error instanceof BaseError) {
            return error;
        }

        if (error instanceof Error) {
            return new BaseError(error.message, {
                code: 'WRAPPED_ERROR',
                context: { originalName: error.name, originalStack: error.stack }
            });
        }

        if (typeof error === 'string') {
            return new BaseError(error, { code: 'STRING_ERROR' });
        }

        if (typeof error === 'object' && error !== null) {
            return new BaseError(
                error.message || 'Unknown object error',
                { code: 'OBJECT_ERROR', context: error }
            );
        }

        return new BaseError('Unknown error occurred', {
            code: 'UNKNOWN_ERROR',
            context: { originalError: error }
        });
    }

    /**
     * Tracks error statistics
     */
    trackError(error) {
        // Count by error code
        const count = this.errorCounts.get(error.code) || 0;
        this.errorCounts.set(error.code, count + 1);

        // Add to recent errors
        this.recentErrors.push({
            timestamp: error.timestamp,
            code: error.code,
            message: error.message,
            severity: error.severity
        });

        // Maintain recent errors size
        if (this.recentErrors.length > this.maxRecentErrors) {
            this.recentErrors.shift();
        }
    }

    /**
     * Logs error with appropriate level
     */
    logError(error) {
        const logData = {
            code: error.code,
            severity: error.severity,
            recoverable: error.recoverable,
            context: error.context,
            handlerContext: error.handlerContext
        };

        switch (error.severity) {
            case 'low':
                logger.warn(error.message, logData);
                break;
            case 'medium':
                logger.error(error.message, logData);
                break;
            case 'high':
                logger.fatal(error.message, {
                    ...logData,
                    stack: this.formatStack(error.stack)
                });
                break;
            default:
                logger.error(error.message, logData);
        }
    }

    /**
     * Sends error notifications for critical errors
     */
    notifyError(error) {
        const severityLevels = { low: 1, medium: 2, high: 3 };
        const thresholdLevel = severityLevels[this.options.notificationThreshold] || 2;
        const errorLevel = severityLevels[error.severity] || 2;

        if (errorLevel >= thresholdLevel) {
            // In a real implementation, this would send notifications
            // via email, Slack, PagerDuty, etc.
            console.log(`🚨 NOTIFICATION: ${error.severity.toUpperCase()} error occurred`);
            console.log(`Code: ${error.code}`);
            console.log(`Message: ${error.message}`);
        }
    }

    /**
     * Attempts automatic error recovery
     */
    attemptRecovery(error) {
        logger.debug(`Attempting recovery for error: ${error.code}`);

        switch (error.code) {
            case 'NETWORK_ERROR':
                // Could implement retry logic
                logger.info('Network error recovery: Consider retrying the operation');
                break;
            case 'API_ERROR':
                // Could implement fallback API calls
                logger.info('API error recovery: Consider using fallback service');
                break;
            case 'VALIDATION_ERROR':
                // Could provide suggestions for fixing input
                logger.info('Validation error recovery: Check input format');
                break;
            default:
                logger.debug(`No recovery strategy available for ${error.code}`);
        }
    }

    /**
     * Formats stack trace for logging
     */
    formatStack(stack) {
        if (!stack) return null;

        const lines = stack.split('\n');
        const relevantLines = lines.slice(0, this.options.maxStackTrace);

        return relevantLines
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join(' | ');
    }

    /**
     * Creates error middleware for Express.js
     */
    createExpressMiddleware() {
        return (error, req, res, next) => {
            const handledError = this.handle(error, {
                url: req.url,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('user-agent')
            });

            res.status(handledError.statusCode).json({
                success: false,
                error: {
                    message: handledError.getUserMessage(),
                    code: handledError.code,
                    timestamp: handledError.timestamp
                }
            });
        };
    }

    /**
     * Creates error handler for promises
     */
    createPromiseHandler() {
        return (error) => {
            return this.handle(error, { source: 'unhandled_promise_rejection' });
        };
    }

    /**
     * Gets error statistics
     */
    getStats() {
        return {
            totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
            errorsByCode: Object.fromEntries(this.errorCounts),
            recentErrorsCount: this.recentErrors.length,
            recentErrors: this.recentErrors.slice(-10) // Last 10 errors
        };
    }

    /**
     * Clears error statistics
     */
    clearStats() {
        this.errorCounts.clear();
        this.recentErrors = [];
    }

    /**
     * Wraps a function with error handling
     */
    wrap(fn, context = {}) {
        return (...args) => {
            try {
                const result = fn(...args);

                // Handle promises
                if (result && typeof result.catch === 'function') {
                    return result.catch(error => {
                        throw this.handle(error, context);
                    });
                }

                return result;
            } catch (error) {
                throw this.handle(error, context);
            }
        };
    }
}

// Export error classes and handler
const errorClasses = {
    BaseError,
    ValidationError,
    DatabaseError,
    ApiError,
    AuthenticationError,
    AuthorizationError,
    NetworkError,
    ConfigurationError
};

// ES6 exports
export {
    ErrorHandler,
    BaseError,
    ValidationError,
    DatabaseError,
    ApiError,
    AuthenticationError,
    AuthorizationError,
    NetworkError,
    ConfigurationError
};

// CommonJS compatibility
module.exports = {
    ErrorHandler,
    ...errorClasses
};
