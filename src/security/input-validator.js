/**
 * Input Validator
 * Validates and sanitizes all user inputs for security
 */

const path = require('path');
const fs = require('fs').promises;

class InputValidator {
    constructor(options = {}, logger) {
        this.maxPathLength = options.maxPathLength || 4096;
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.allowedExtensions = options.allowedExtensions || [
            '.js', '.jsx', '.ts', '.tsx', '.py', '.json'
        ];
        this.blockedPaths = options.blockedPaths || [
            '/etc', '/proc', '/sys', '/dev', '/root', '/boot'
        ];
        this.maxContentLength = options.maxContentLength || 1024 * 1024; // 1MB
        this.logger = logger;
    }

    validateRepositoryPath(repositoryPath) {
        const errors = [];

        // Check if path is provided
        if (!repositoryPath || typeof repositoryPath !== 'string') {
            errors.push('Repository path is required and must be a string');
            return { valid: false, errors, sanitized: null };
        }

        // Check path length
        if (repositoryPath.length > this.maxPathLength) {
            errors.push(`Path too long (max ${this.maxPathLength} characters)`);
        }

        // Sanitize and resolve path
        let sanitizedPath;
        try {
            sanitizedPath = path.resolve(repositoryPath);
        } catch (error) {
            errors.push('Invalid path format');
            return { valid: false, errors, sanitized: null };
        }

        // Check for directory traversal attempts
        if (this.containsTraversalAttempt(repositoryPath)) {
            errors.push('Path contains directory traversal sequences');
        }

        // Check against blocked paths (Unix/Linux systems)
        if (process.platform !== 'win32' && this.isBlockedPath(sanitizedPath)) {
            errors.push('Access to this path is not allowed');
        }

        // Check for null bytes
        if (repositoryPath.includes('\0')) {
            errors.push('Path contains null bytes');
        }

        // Check for suspicious characters
        if (this.containsSuspiciousChars(repositoryPath)) {
            errors.push('Path contains suspicious characters');
        }

        return {
            valid: errors.length === 0,
            errors,
            sanitized: sanitizedPath
        };
    }

    async validateFile(filePath) {
        const errors = [];

        try {
            // Check if file exists and is accessible
            const stats = await fs.stat(filePath);

            // Check if it's actually a file
            if (!stats.isFile()) {
                errors.push('Path is not a file');
            }

            // Check file size
            if (stats.size > this.maxFileSize) {
                errors.push(`File too large (max ${this.formatBytes(this.maxFileSize)})`);
            }

            // Check file extension
            const ext = path.extname(filePath).toLowerCase();
            if (!this.allowedExtensions.includes(ext)) {
                errors.push(`File extension '${ext}' not allowed`);
            }

            // Check for suspicious file names
            if (this.isSuspiciousFileName(path.basename(filePath))) {
                errors.push('Suspicious file name detected');
            }

        } catch (error) {
            if (error.code === 'ENOENT') {
                errors.push('File does not exist');
            } else if (error.code === 'EACCES') {
                errors.push('Permission denied');
            } else {
                errors.push(`File access error: ${error.message}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    sanitizeFileContent(content, filePath) {
        const errors = [];
        let sanitized = content;

        // Check content length
        if (content.length > this.maxContentLength) {
            errors.push(`Content too large (max ${this.formatBytes(this.maxContentLength)})`);
            return { valid: false, errors, sanitized: null };
        }

        // Check for null bytes
        if (content.includes('\0')) {
            this.logger?.warn('Null bytes found in content, removing', { filePath });
            sanitized = content.replace(/\0/g, '');
        }

        // Check for extremely long lines (potential DoS)
        const lines = sanitized.split('\n');
        const maxLineLength = 10000;
        const longLines = lines.filter(line => line.length > maxLineLength);
        
        if (longLines.length > 0) {
            this.logger?.warn('Extremely long lines detected', {
                filePath,
                count: longLines.length,
                maxLength: Math.max(...longLines.map(l => l.length))
            });
        }

        // Basic encoding validation
        try {
            Buffer.from(sanitized, 'utf8').toString('utf8');
        } catch (error) {
            errors.push('Invalid UTF-8 encoding');
            return { valid: false, errors, sanitized: null };
        }

        // Check for binary content
        if (this.isBinaryContent(sanitized)) {
            errors.push('File appears to be binary');
            return { valid: false, errors, sanitized: null };
        }

        return {
            valid: errors.length === 0,
            errors,
            sanitized
        };
    }

    sanitizeImportPath(importPath) {
        if (!importPath || typeof importPath !== 'string') {
            return { valid: false, sanitized: null };
        }

        // Remove dangerous characters
        let sanitized = importPath
            .replace(/[\x00-\x1f\x7f]/g, '') // Control characters
            .replace(/[<>"|?*]/g, '')        // Dangerous characters
            .trim();

        // Check for traversal attempts
        if (sanitized.includes('..')) {
            // Allow relative imports but log suspicious patterns
            const suspiciousPatterns = [
                /\.{3,}/,           // More than 2 dots
                /\/\.{2,}\//,       // Dots in middle of path
                /^\.{2,}[^\/]/      // Dots not followed by slash
            ];

            if (suspiciousPatterns.some(pattern => pattern.test(sanitized))) {
                return { valid: false, sanitized: null };
            }
        }

        return {
            valid: sanitized.length > 0 && sanitized.length < 500,
            sanitized
        };
    }

    containsTraversalAttempt(inputPath) {
        const traversalPatterns = [
            '../',
            '..\\',
            '/..',
            '\\..',
            '%2e%2e',
            '%252e%252e',
            '..%2f',
            '..%5c',
            '..%252f',
            '..%255c'
        ];

        const normalizedPath = inputPath.toLowerCase();
        return traversalPatterns.some(pattern => 
            normalizedPath.includes(pattern.toLowerCase())
        );
    }

    isBlockedPath(resolvedPath) {
        return this.blockedPaths.some(blockedPath => 
            resolvedPath.startsWith(blockedPath)
        );
    }

    containsSuspiciousChars(inputPath) {
        // Check for suspicious characters that might indicate injection attempts
        const suspiciousChars = /[<>:"|?*\x00-\x1f\x7f]/;
        return suspiciousChars.test(inputPath);
    }

    isSuspiciousFileName(fileName) {
        const suspiciousPatterns = [
            /^\.+$/,           // Only dots
            /[\x00-\x1f]/,     // Control characters
            /[<>:"|?*]/,       // Windows reserved characters
            /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
            /\.(exe|bat|cmd|scr|pif|com)$/i // Executable extensions
        ];

        return suspiciousPatterns.some(pattern => pattern.test(fileName));
    }

    isBinaryContent(content) {
        // Check for binary content by looking for null bytes and non-printable characters
        const nullBytes = (content.match(/\0/g) || []).length;
        const nonPrintable = (content.match(/[\x00-\x08\x0E-\x1F\x7F]/g) || []).length;
        
        // If more than 1% of content is non-printable, consider it binary
        const threshold = content.length * 0.01;
        return nullBytes > 0 || nonPrintable > threshold;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Validate configuration options
    validateConfigOptions(options) {
        const errors = [];
        const sanitized = {};

        // Validate output file path
        if (options.outputFile) {
            const outputValidation = this.validateOutputPath(options.outputFile);
            if (!outputValidation.valid) {
                errors.push(...outputValidation.errors.map(e => `Output file: ${e}`));
            } else {
                sanitized.outputFile = outputValidation.sanitized;
            }
        }

        // Validate format
        if (options.format && !['json', 'js'].includes(options.format)) {
            errors.push('Format must be "json" or "js"');
        } else if (options.format) {
            sanitized.format = options.format;
        }

        // Validate boolean flags
        ['verbose', 'includeExternal', 'quiet'].forEach(flag => {
            if (options[flag] !== undefined && typeof options[flag] !== 'boolean') {
                errors.push(`${flag} must be a boolean`);
            } else if (options[flag] !== undefined) {
                sanitized[flag] = options[flag];
            }
        });

        // Validate exclude patterns
        if (options.excludePatterns) {
            if (!Array.isArray(options.excludePatterns)) {
                errors.push('excludePatterns must be an array');
            } else {
                const validPatterns = options.excludePatterns.filter(pattern => 
                    typeof pattern === 'string' && pattern.length > 0 && pattern.length < 200
                );
                sanitized.excludePatterns = validPatterns;
            }
        }

        // Validate numeric options
        if (options.maxFileSize !== undefined) {
            const size = parseInt(options.maxFileSize);
            if (isNaN(size) || size < 1 || size > 100 * 1024 * 1024) {
                errors.push('maxFileSize must be between 1 byte and 100MB');
            } else {
                sanitized.maxFileSize = size;
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            sanitized
        };
    }

    validateOutputPath(outputPath) {
        const errors = [];

        if (!outputPath || typeof outputPath !== 'string') {
            errors.push('Output path must be a string');
            return { valid: false, errors, sanitized: null };
        }

        // Sanitize path
        let sanitizedPath;
        try {
            sanitizedPath = path.resolve(outputPath);
        } catch (error) {
            errors.push('Invalid output path format');
            return { valid: false, errors, sanitized: null };
        }

        // Check if trying to write to system directories
        if (process.platform !== 'win32' && this.isSystemPath(sanitizedPath)) {
            errors.push('Cannot write to system directories');
        }

        // Check file extension
        const ext = path.extname(sanitizedPath).toLowerCase();
        if (!['.json', '.js'].includes(ext)) {
            errors.push('Output file must have .json or .js extension');
        }

        return {
            valid: errors.length === 0,
            errors,
            sanitized: sanitizedPath
        };
    }

    isSystemPath(resolvedPath) {
        const systemPaths = [
            '/bin', '/sbin', '/usr/bin', '/usr/sbin',
            '/etc', '/boot', '/sys', '/proc'
        ];

        return systemPaths.some(systemPath => 
            resolvedPath.startsWith(systemPath)
        );
    }
}

module.exports = { InputValidator };