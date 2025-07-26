/**
 * Input validation utilities
 * Provides comprehensive validation for various data types and structures
 */

// Configuration validation schema
const CONFIG_SCHEMA = {
    database: {
        required: true,
        type: 'object',
        properties: {
            host: { type: 'string', required: true },
            port: { type: 'number', required: true, min: 1, max: 65535 },
            name: { type: 'string', required: true, minLength: 1 }
        }
    },
    api: {
        required: true,
        type: 'object',
        properties: {
            baseUrl: { type: 'string', required: true, pattern: /^https?:\/\/.+/ },
            timeout: { type: 'number', required: false, min: 1000, max: 60000 }
        }
    }
};

/**
 * Validates input data against a schema
 */
function validateInput(data, schema = null) {
    if (!data) {
        throw new ValidationError('Input data is required');
    }

    // If no schema provided, use basic validation
    if (!schema) {
        return validateBasicInput(data);
    }

    return validateAgainstSchema(data, schema);
}

/**
 * Basic input validation for general data
 */
function validateBasicInput(data) {
    // Handle different data types
    if (typeof data === 'string') {
        return validateString(data);
    }

    if (Array.isArray(data)) {
        return validateArray(data);
    }

    if (typeof data === 'object') {
        return validateObject(data);
    }

    return data;
}

/**
 * Validates string input
 */
function validateString(str) {
    if (typeof str !== 'string') {
        throw new ValidationError('Expected string input');
    }

    // Remove potentially dangerous characters
    const sanitized = str.trim().replace(/[<>]/g, '');

    if (sanitized.length === 0) {
        throw new ValidationError('String cannot be empty');
    }

    return sanitized;
}

/**
 * Validates array input
 */
function validateArray(arr) {
    if (!Array.isArray(arr)) {
        throw new ValidationError('Expected array input');
    }

    if (arr.length === 0) {
        throw new ValidationError('Array cannot be empty');
    }

    // Validate each item in the array
    return arr.map((item, index) => {
        try {
            return validateBasicInput(item);
        } catch (error) {
            throw new ValidationError(`Invalid item at index ${index}: ${error.message}`);
        }
    });
}

/**
 * Validates object input
 */
function validateObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
        throw new ValidationError('Expected object input');
    }

    const validated = {};

    for (const [key, value] of Object.entries(obj)) {
        // Validate key
        if (typeof key !== 'string' || key.trim().length === 0) {
            throw new ValidationError('Object keys must be non-empty strings');
        }

        // Validate value
        validated[key] = validateBasicInput(value);
    }

    return validated;
}

/**
 * Validates data against a specific schema
 */
function validateAgainstSchema(data, schema) {
    const errors = [];

    function validateProperty(value, propSchema, path = '') {
        // Check required
        if (propSchema.required && (value === undefined || value === null)) {
            errors.push(`${path} is required`);
            return;
        }

        if (value === undefined || value === null) {
            return;
        }

        // Check type
        if (propSchema.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== propSchema.type) {
                errors.push(`${path} must be of type ${propSchema.type}, got ${actualType}`);
                return;
            }
        }

        // Type-specific validations
        switch (propSchema.type) {
            case 'string':
                if (propSchema.minLength && value.length < propSchema.minLength) {
                    errors.push(`${path} must be at least ${propSchema.minLength} characters long`);
                }
                if (propSchema.pattern && !propSchema.pattern.test(value)) {
                    errors.push(`${path} does not match required pattern`);
                }
                break;

            case 'number':
                if (propSchema.min !== undefined && value < propSchema.min) {
                    errors.push(`${path} must be at least ${propSchema.min}`);
                }
                if (propSchema.max !== undefined && value > propSchema.max) {
                    errors.push(`${path} must be at most ${propSchema.max}`);
                }
                break;

            case 'object':
                if (propSchema.properties) {
                    for (const [subKey, subSchema] of Object.entries(propSchema.properties)) {
                        validateProperty(value[subKey], subSchema, `${path}.${subKey}`);
                    }
                }
                break;
        }
    }

    for (const [key, propSchema] of Object.entries(schema)) {
        validateProperty(data[key], propSchema, key);
    }

    if (errors.length > 0) {
        throw new ValidationError(`Validation failed: ${errors.join(', ')}`);
    }

    return data;
}

/**
 * Validates configuration objects
 */
function validateConfig(config) {
    return validateAgainstSchema(config, CONFIG_SCHEMA);
}

/**
 * Validates email addresses
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || typeof email !== 'string') {
        throw new ValidationError('Email is required and must be a string');
    }

    if (!emailRegex.test(email)) {
        throw new ValidationError('Invalid email format');
    }

    return email.toLowerCase().trim();
}

/**
 * Validates URLs
 */
function validateUrl(url) {
    if (!url || typeof url !== 'string') {
        throw new ValidationError('URL is required and must be a string');
    }

    try {
        new URL(url);
        return url;
    } catch {
        throw new ValidationError('Invalid URL format');
    }
}

/**
 * Custom validation error class
 */
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

// ES6 exports
export {
    validateInput,
    validateConfig,
    validateEmail,
    validateUrl,
    ValidationError
};

// CommonJS compatibility
module.exports = {
    validateInput,
    validateConfig,
    validateEmail,
    validateUrl,
    ValidationError
};
