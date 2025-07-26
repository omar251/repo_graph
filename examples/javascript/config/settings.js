/**
 * Application configuration settings
 * Centralized configuration for all application components
 */

const path = require('path');

// Environment-specific configurations
const environments = {
    development: {
        database: {
            host: 'localhost',
            port: 5432,
            name: 'app_dev',
            username: 'dev_user',
            password: 'dev_password',
            ssl: false,
            pool: {
                min: 2,
                max: 10,
                acquireTimeoutMillis: 30000,
                idleTimeoutMillis: 30000
            }
        },
        api: {
            baseUrl: 'http://localhost:3000',
            timeout: 10000,
            retryAttempts: 3,
            retryDelay: 1000
        },
        logging: {
            level: 'debug',
            enableColors: true,
            enableTimestamps: true,
            outputs: ['console']
        }
    },

    production: {
        database: {
            host: process.env.DB_HOST || 'prod-db.example.com',
            port: parseInt(process.env.DB_PORT) || 5432,
            name: process.env.DB_NAME || 'app_prod',
            username: process.env.DB_USER || 'app_user',
            password: process.env.DB_PASSWORD || '',
            ssl: true,
            pool: {
                min: 5,
                max: 20,
                acquireTimeoutMillis: 60000,
                idleTimeoutMillis: 60000
            }
        },
        api: {
            baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
            timeout: 30000,
            retryAttempts: 5,
            retryDelay: 2000
        },
        logging: {
            level: 'info',
            enableColors: false,
            enableTimestamps: true,
            outputs: ['console', 'file']
        }
    },

    test: {
        database: {
            host: 'localhost',
            port: 5433,
            name: 'app_test',
            username: 'test_user',
            password: 'test_password',
            ssl: false,
            pool: {
                min: 1,
                max: 5,
                acquireTimeoutMillis: 15000,
                idleTimeoutMillis: 15000
            }
        },
        api: {
            baseUrl: 'http://localhost:3001',
            timeout: 5000,
            retryAttempts: 1,
            retryDelay: 500
        },
        logging: {
            level: 'warn',
            enableColors: true,
            enableTimestamps: false,
            outputs: ['console']
        }
    }
};

// Current environment
const currentEnv = process.env.NODE_ENV || 'development';

// Base configuration that applies to all environments
const baseConfig = {
    // Application settings
    app: {
        name: 'Example Application',
        version: '1.0.0',
        port: parseInt(process.env.PORT) || 3000,
        host: process.env.HOST || '0.0.0.0',
        timezone: 'UTC'
    },

    // Security settings
    security: {
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        jwtExpiration: '24h',
        bcryptRounds: 12,
        corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
        rateLimiting: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: 100
        }
    },

    // File upload settings
    upload: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
            'text/plain'
        ],
        uploadDir: path.join(__dirname, '../../uploads'),
        tempDir: path.join(__dirname, '../../temp')
    },

    // Cache settings
    cache: {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || null,
            db: parseInt(process.env.REDIS_DB) || 0,
            ttl: 3600 // 1 hour default TTL
        },
        memory: {
            max: 1000,
            ttl: 300 // 5 minutes
        }
    },

    // Email settings
    email: {
        smtp: {
            host: process.env.SMTP_HOST || 'smtp.example.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || ''
            }
        },
        from: {
            name: 'Example Application',
            address: process.env.FROM_EMAIL || 'noreply@example.com'
        },
        templates: {
            welcome: 'welcome.html',
            passwordReset: 'password-reset.html',
            notification: 'notification.html'
        }
    },

    // Monitoring and health check settings
    monitoring: {
        healthCheck: {
            timeout: 5000,
            interval: 30000
        },
        metrics: {
            enabled: process.env.METRICS_ENABLED === 'true',
            port: parseInt(process.env.METRICS_PORT) || 9090
        }
    },

    // Feature flags
    features: {
        enableRegistration: process.env.ENABLE_REGISTRATION !== 'false',
        enableEmailVerification: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
        enableTwoFactorAuth: process.env.ENABLE_2FA === 'true',
        maintenanceMode: process.env.MAINTENANCE_MODE === 'true'
    },

    // External service configurations
    services: {
        payment: {
            stripe: {
                publicKey: process.env.STRIPE_PUBLIC_KEY || '',
                secretKey: process.env.STRIPE_SECRET_KEY || '',
                webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
            }
        },
        analytics: {
            googleAnalytics: {
                trackingId: process.env.GA_TRACKING_ID || ''
            }
        },
        storage: {
            aws: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
                region: process.env.AWS_REGION || 'us-east-1',
                bucket: process.env.AWS_S3_BUCKET || ''
            }
        }
    }
};

// Merge base config with environment-specific config
const config = {
    ...baseConfig,
    ...environments[currentEnv],
    environment: currentEnv
};

// Configuration validation
function validateConfig(config) {
    const required = [
        'database.host',
        'database.port',
        'database.name',
        'api.baseUrl',
        'security.jwtSecret'
    ];

    const missing = required.filter(key => {
        const keys = key.split('.');
        let value = config;
        for (const k of keys) {
            value = value?.[k];
        }
        return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    return true;
}

// Validate configuration on load
try {
    validateConfig(config);
} catch (error) {
    console.error('Configuration validation failed:', error.message);
    process.exit(1);
}

// Helper function to get nested config values
config.get = function(path, defaultValue = null) {
    const keys = path.split('.');
    let value = this;

    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return defaultValue;
        }
    }

    return value;
};

// Helper function to check if we're in a specific environment
config.isDevelopment = () => currentEnv === 'development';
config.isProduction = () => currentEnv === 'production';
config.isTest = () => currentEnv === 'test';

module.exports = config;
