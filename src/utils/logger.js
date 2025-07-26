/**
 * Logger Utility
 * Provides structured logging with multiple levels and outputs
 */

const fs = require('fs').promises;
const path = require('path');

class Logger {
    constructor(options = {}) {
        this.level = options.level || 'info';
        this.verbose = options.verbose || false;
        this.logFile = options.logFile;
        this.enableColors = options.colors !== false && process.stdout.isTTY;
        this.quiet = options.quiet || false;
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };
        
        this.colors = {
            error: '\x1b[31m',   // Red
            warn: '\x1b[33m',    // Yellow
            info: '\x1b[36m',    // Cyan
            debug: '\x1b[35m',   // Magenta
            trace: '\x1b[37m',   // White
            reset: '\x1b[0m'
        };
        
        this.symbols = {
            error: '❌',
            warn: '⚠️',
            info: 'ℹ️',
            debug: '🔍',
            trace: '📝'
        };
    }

    shouldLog(level) {
        if (this.quiet && level !== 'error') {
            return false;
        }
        return this.levels[level] <= this.levels[this.level];
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const symbol = this.symbols[level] || '';
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta, null, 2)}` : '';
        
        let baseMessage;
        if (this.verbose) {
            baseMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
        } else {
            baseMessage = `${symbol} ${message}`;
            if (level === 'error' || level === 'warn') {
                baseMessage += metaStr;
            }
        }
        
        if (this.enableColors && !this.logFile) {
            const color = this.colors[level] || '';
            return `${color}${baseMessage}${this.colors.reset}`;
        }
        
        return baseMessage;
    }

    async log(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;
        
        const formattedMessage = this.formatMessage(level, message, meta);
        
        // Console output
        if (!this.quiet || level === 'error') {
            if (level === 'error') {
                console.error(formattedMessage);
            } else {
                console.log(formattedMessage);
            }
        }
        
        // File output
        if (this.logFile) {
            try {
                const fileMessage = this.formatMessage(level, message, meta).replace(/\x1b\[[0-9;]*m/g, ''); // Remove colors
                await fs.appendFile(this.logFile, fileMessage + '\n');
            } catch (error) {
                console.error('Failed to write to log file:', error.message);
            }
        }
    }

    error(message, meta = {}) { return this.log('error', message, meta); }
    warn(message, meta = {}) { return this.log('warn', message, meta); }
    info(message, meta = {}) { return this.log('info', message, meta); }
    debug(message, meta = {}) { return this.log('debug', message, meta); }
    trace(message, meta = {}) { return this.log('trace', message, meta); }

    // Convenience methods for common scenarios
    async logFileProcessing(filePath, status, meta = {}) {
        const fileName = path.basename(filePath);
        await this.debug(`Processing ${fileName}`, { status, filePath, ...meta });
    }

    async logAnalysisProgress(current, total, meta = {}) {
        const percentage = Math.round((current / total) * 100);
        await this.info(`Progress: ${current}/${total} (${percentage}%)`, meta);
    }

    async logPerformance(operation, duration, meta = {}) {
        await this.debug(`Performance: ${operation} took ${duration}ms`, meta);
    }

    // Create a child logger with additional context
    child(context = {}) {
        const childLogger = new Logger({
            level: this.level,
            verbose: this.verbose,
            logFile: this.logFile,
            colors: this.enableColors,
            quiet: this.quiet
        });
        
        // Override log method to include context
        const originalLog = childLogger.log.bind(childLogger);
        childLogger.log = async (level, message, meta = {}) => {
            return originalLog(level, message, { ...context, ...meta });
        };
        
        return childLogger;
    }
}

module.exports = { Logger };