/**
 * Logging utility with multiple levels and formatting options
 * Provides structured logging with timestamps, colors, and configurable output
 */

// ANSI color codes for console output
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',

    // Text colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',

    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m'
};

// Log levels with priorities
const LOG_LEVELS = {
    debug: { priority: 0, color: COLORS.cyan, icon: '🔍' },
    info: { priority: 1, color: COLORS.blue, icon: 'ℹ️' },
    warn: { priority: 2, color: COLORS.yellow, icon: '⚠️' },
    error: { priority: 3, color: COLORS.red, icon: '❌' },
    fatal: { priority: 4, color: COLORS.bgRed + COLORS.white, icon: '💀' }
};

class Logger {
    constructor(options = {}) {
        this.options = {
            level: 'info',
            enableColors: true,
            enableTimestamps: true,
            enableIcons: true,
            dateFormat: 'YYYY-MM-DD HH:mm:ss',
            context: '',
            outputs: ['console'],
            maxLogHistory: 1000,
            ...options
        };

        this.logHistory = [];
        this.currentLevel = LOG_LEVELS[this.options.level] || LOG_LEVELS.info;
    }

    /**
     * Sets the minimum log level
     */
    setLevel(level) {
        if (LOG_LEVELS[level]) {
            this.options.level = level;
            this.currentLevel = LOG_LEVELS[level];
        } else {
            this.warn(`Unknown log level: ${level}. Using 'info' instead.`);
        }
    }

    /**
     * Sets the context for all log messages
     */
    setContext(context) {
        this.options.context = context;
    }

    /**
     * Formats a timestamp according to the configured format
     */
    formatTimestamp(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ms = String(date.getMilliseconds()).padStart(3, '0');

        return this.options.dateFormat
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds)
            .replace('SSS', ms);
    }

    /**
     * Formats a log message with all components
     */
    formatMessage(level, message, meta = {}) {
        const timestamp = this.options.enableTimestamps ?
            `[${this.formatTimestamp()}]` : '';

        const context = this.options.context ?
            `[${this.options.context}]` : '';

        const levelLabel = `[${level.toUpperCase()}]`;

        const icon = this.options.enableIcons ?
            LOG_LEVELS[level].icon + ' ' : '';

        // Handle different message types
        let formattedMessage = message;
        if (typeof message === 'object') {
            formattedMessage = JSON.stringify(message, null, 2);
        }

        // Add metadata if provided
        let metaString = '';
        if (Object.keys(meta).length > 0) {
            metaString = ' ' + JSON.stringify(meta);
        }

        return {
            plain: `${timestamp} ${context} ${levelLabel} ${formattedMessage}${metaString}`,
            colored: this.options.enableColors ?
                `${COLORS.dim}${timestamp}${COLORS.reset} ` +
                `${COLORS.magenta}${context}${COLORS.reset} ` +
                `${LOG_LEVELS[level].color}${levelLabel}${COLORS.reset} ` +
                `${icon}${formattedMessage}${COLORS.dim}${metaString}${COLORS.reset}` :
                `${timestamp} ${context} ${levelLabel} ${icon}${formattedMessage}${metaString}`
        };
    }

    /**
     * Core logging method
     */
    log(level, message, meta = {}) {
        const logLevel = LOG_LEVELS[level];

        if (!logLevel || logLevel.priority < this.currentLevel.priority) {
            return;
        }

        const formattedMessage = this.formatMessage(level, message, meta);
        const logEntry = {
            timestamp: new Date(),
            level,
            message,
            meta,
            formatted: formattedMessage.plain
        };

        // Add to history
        this.logHistory.push(logEntry);
        if (this.logHistory.length > this.options.maxLogHistory) {
            this.logHistory.shift();
        }

        // Output to configured destinations
        this.options.outputs.forEach(output => {
            switch (output) {
                case 'console':
                    this.outputToConsole(level, formattedMessage);
                    break;
                case 'file':
                    this.outputToFile(logEntry);
                    break;
            }
        });
    }

    /**
     * Outputs log message to console
     */
    outputToConsole(level, formattedMessage) {
        const message = this.options.enableColors ?
            formattedMessage.colored : formattedMessage.plain;

        switch (level) {
            case 'error':
            case 'fatal':
                console.error(message);
                break;
            case 'warn':
                console.warn(message);
                break;
            default:
                console.log(message);
        }
    }

    /**
     * Outputs log message to file (placeholder for file logging)
     */
    outputToFile(logEntry) {
        // In a real implementation, this would write to a file
        // For this example, we'll just store it in memory
        if (!this.fileBuffer) {
            this.fileBuffer = [];
        }
        this.fileBuffer.push(logEntry.formatted);
    }

    /**
     * Debug level logging
     */
    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }

    /**
     * Info level logging
     */
    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    /**
     * Warning level logging
     */
    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    /**
     * Error level logging
     */
    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    /**
     * Fatal level logging
     */
    fatal(message, meta = {}) {
        this.log('fatal', message, meta);
    }

    /**
     * Creates a child logger with additional context
     */
    child(childContext) {
        const fullContext = this.options.context ?
            `${this.options.context}:${childContext}` : childContext;

        return new Logger({
            ...this.options,
            context: fullContext
        });
    }

    /**
     * Logs execution time of a function
     */
    async time(label, fn) {
        const startTime = Date.now();
        this.debug(`Starting ${label}...`);

        try {
            const result = await fn();
            const duration = Date.now() - startTime;
            this.info(`Completed ${label}`, { duration: `${duration}ms` });
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.error(`Failed ${label}`, {
                duration: `${duration}ms`,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Returns the log history
     */
    getHistory(level = null) {
        if (level) {
            return this.logHistory.filter(entry => entry.level === level);
        }
        return [...this.logHistory];
    }

    /**
     * Clears the log history
     */
    clearHistory() {
        this.logHistory = [];
        if (this.fileBuffer) {
            this.fileBuffer = [];
        }
    }

    /**
     * Creates a performance logger for measuring execution time
     */
    performance(label) {
        const startTime = performance.now();
        this.debug(`Performance: Starting ${label}`);

        return {
            end: (meta = {}) => {
                const endTime = performance.now();
                const duration = Math.round((endTime - startTime) * 100) / 100;
                this.info(`Performance: ${label} completed`, {
                    duration: `${duration}ms`,
                    ...meta
                });
                return duration;
            }
        };
    }
}

// Create default logger instance
const defaultLogger = new Logger({
    context: 'APP',
    level: process.env.LOG_LEVEL || 'info',
    enableColors: process.env.NODE_ENV !== 'production'
});

// ES6 exports
export default defaultLogger;
export { Logger, LOG_LEVELS };

// CommonJS compatibility
module.exports = defaultLogger;
module.exports.Logger = Logger;
module.exports.LOG_LEVELS = LOG_LEVELS;
