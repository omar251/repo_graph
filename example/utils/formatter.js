/**
 * Data formatting utilities
 * Provides various formatting functions for different data types
 */

import { validateInput } from './validator.js';

const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const DEFAULT_NUMBER_LOCALE = 'en-US';

/**
 * Formats output data for API responses
 */
function formatOutput(data, options = {}) {
    if (!data) {
        return null;
    }

    const defaultOptions = {
        includeTimestamp: true,
        includeMetadata: true,
        dateFormat: DEFAULT_DATE_FORMAT,
        numberLocale: DEFAULT_NUMBER_LOCALE
    };

    const config = { ...defaultOptions, ...options };

    try {
        // Validate input data
        const validatedData = validateInput(data);

        let formatted = {
            data: validatedData
        };

        if (config.includeTimestamp) {
            formatted.timestamp = formatDate(new Date(), config.dateFormat);
        }

        if (config.includeMetadata) {
            formatted.metadata = generateMetadata(validatedData);
        }

        return formatted;

    } catch (error) {
        throw new FormattingError(`Failed to format output: ${error.message}`);
    }
}

/**
 * Formats dates according to specified format
 */
function formatDate(date, format = DEFAULT_DATE_FORMAT) {
    if (!(date instanceof Date) || isNaN(date)) {
        throw new FormattingError('Invalid date provided');
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    const formatMap = {
        'YYYY': year,
        'MM': month,
        'DD': day,
        'HH': hours,
        'mm': minutes,
        'ss': seconds
    };

    let formatted = format;
    for (const [placeholder, value] of Object.entries(formatMap)) {
        formatted = formatted.replace(new RegExp(placeholder, 'g'), value);
    }

    return formatted;
}

/**
 * Formats numbers with proper locale and currency
 */
function formatNumber(number, options = {}) {
    if (typeof number !== 'number' || isNaN(number)) {
        throw new FormattingError('Invalid number provided');
    }

    const defaultOptions = {
        locale: DEFAULT_NUMBER_LOCALE,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    };

    const config = { ...defaultOptions, ...options };

    return new Intl.NumberFormat(config.locale, config).format(number);
}

/**
 * Formats currency values
 */
function formatCurrency(amount, currency = 'USD', locale = DEFAULT_NUMBER_LOCALE) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        throw new FormattingError('Invalid amount provided');
    }

    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
    }).format(amount);
}

/**
 * Formats file sizes in human-readable format
 */
function formatFileSize(bytes) {
    if (typeof bytes !== 'number' || bytes < 0) {
        throw new FormattingError('Invalid byte count provided');
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${formatNumber(size, { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
}

/**
 * Formats duration in milliseconds to human-readable format
 */
function formatDuration(milliseconds) {
    if (typeof milliseconds !== 'number' || milliseconds < 0) {
        throw new FormattingError('Invalid duration provided');
    }

    const units = [
        { name: 'ms', value: 1 },
        { name: 's', value: 1000 },
        { name: 'm', value: 60 * 1000 },
        { name: 'h', value: 60 * 60 * 1000 },
        { name: 'd', value: 24 * 60 * 60 * 1000 }
    ];

    for (let i = units.length - 1; i >= 0; i--) {
        const unit = units[i];
        if (milliseconds >= unit.value) {
            const value = milliseconds / unit.value;
            return `${formatNumber(value, { maximumFractionDigits: 1 })}${unit.name}`;
        }
    }

    return `${milliseconds}ms`;
}

/**
 * Formats arrays as comma-separated strings
 */
function formatArray(array, options = {}) {
    if (!Array.isArray(array)) {
        throw new FormattingError('Input must be an array');
    }

    const defaultOptions = {
        separator: ', ',
        lastSeparator: ' and ',
        maxItems: null,
        truncateIndicator: '...'
    };

    const config = { ...defaultOptions, ...options };

    let items = array.slice();

    if (config.maxItems && items.length > config.maxItems) {
        items = items.slice(0, config.maxItems);
        items.push(config.truncateIndicator);
    }

    if (items.length <= 1) {
        return items.join('');
    }

    if (items.length === 2) {
        return items.join(config.lastSeparator);
    }

    const lastItem = items.pop();
    return items.join(config.separator) + config.lastSeparator + lastItem;
}

/**
 * Formats objects as key-value pairs
 */
function formatObject(obj, options = {}) {
    if (typeof obj !== 'object' || obj === null) {
        throw new FormattingError('Input must be an object');
    }

    const defaultOptions = {
        keyValueSeparator: ': ',
        pairSeparator: ', ',
        wrapKeys: false,
        wrapValues: false
    };

    const config = { ...defaultOptions, ...options };

    const pairs = Object.entries(obj).map(([key, value]) => {
        const formattedKey = config.wrapKeys ? `"${key}"` : key;
        const formattedValue = config.wrapValues ? `"${value}"` : value;
        return `${formattedKey}${config.keyValueSeparator}${formattedValue}`;
    });

    return pairs.join(config.pairSeparator);
}

/**
 * Generates metadata for formatted data
 */
function generateMetadata(data) {
    const metadata = {
        type: Array.isArray(data) ? 'array' : typeof data,
        size: 0,
        properties: []
    };

    if (Array.isArray(data)) {
        metadata.size = data.length;
        metadata.properties = ['length'];

        if (data.length > 0) {
            metadata.itemType = typeof data[0];
        }
    } else if (typeof data === 'object' && data !== null) {
        metadata.properties = Object.keys(data);
        metadata.size = metadata.properties.length;
    } else if (typeof data === 'string') {
        metadata.size = data.length;
        metadata.properties = ['length'];
    }

    return metadata;
}

/**
 * Truncates text to specified length
 */
function truncateText(text, maxLength, suffix = '...') {
    if (typeof text !== 'string') {
        throw new FormattingError('Input must be a string');
    }

    if (typeof maxLength !== 'number' || maxLength < 0) {
        throw new FormattingError('Max length must be a positive number');
    }

    if (text.length <= maxLength) {
        return text;
    }

    return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalizes the first letter of each word
 */
function titleCase(text) {
    if (typeof text !== 'string') {
        throw new FormattingError('Input must be a string');
    }

    return text.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Converts text to camelCase
 */
function camelCase(text) {
    if (typeof text !== 'string') {
        throw new FormattingError('Input must be a string');
    }

    return text
        .replace(/[^a-zA-Z0-9]+(.)/g, (match, char) => char.toUpperCase())
        .replace(/^[A-Z]/, char => char.toLowerCase());
}

/**
 * Custom formatting error class
 */
class FormattingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FormattingError';
    }
}

// ES6 exports
export {
    formatOutput,
    formatDate,
    formatNumber,
    formatCurrency,
    formatFileSize,
    formatDuration,
    formatArray,
    formatObject,
    truncateText,
    titleCase,
    camelCase,
    FormattingError
};

// CommonJS compatibility
module.exports = {
    formatOutput,
    formatDate,
    formatNumber,
    formatCurrency,
    formatFileSize,
    formatDuration,
    formatArray,
    formatObject,
    truncateText,
    titleCase,
    camelCase,
    FormattingError
};
