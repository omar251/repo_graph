# Deployment Guide

## 📦 Installation Methods

### NPM Package (Recommended)

```bash
# Install globally
npm install -g repo-dependency-graph

# Use anywhere
repo-graph /path/to/project
```

### Local Installation

```bash
# Clone repository
git clone https://github.com/your-org/repo-dependency-graph.git
cd repo-dependency-graph

# Install dependencies
npm install

# Run locally
npm start /path/to/project
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3000

CMD ["npm", "run", "server"]
```

```bash
# Build and run
docker build -t repo-dependency-graph .
docker run -p 3000:3000 -v /path/to/projects:/projects repo-dependency-graph
```

## 🚀 Production Deployment

### Environment Variables

```bash
# Server configuration
PORT=3000
NODE_ENV=production

# Analysis settings
MAX_FILE_SIZE=5242880  # 5MB
CACHE_TTL=3600000      # 1 hour
LOG_LEVEL=info

# Security
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100        # requests per window
```

### PM2 Process Manager

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'repo-dependency-graph',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

```bash
# Deploy with PM2
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static files
    location /static/ {
        alias /path/to/repo-dependency-graph/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 🔧 Configuration Management

### Production Config

```javascript
// config/production.js
module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0'
  },
  analysis: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880,
    excludePatterns: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.git/**',
      'coverage/**'
    ],
    cache: {
      enabled: true,
      ttl: parseInt(process.env.CACHE_TTL) || 3600000
    }
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json'
  },
  security: {
    cors: {
      origin: process.env.CORS_ORIGIN || false
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000,
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100
    }
  }
};
```

## 📊 Monitoring & Logging

### Health Check Endpoint

```javascript
// Add to server.js
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: require('./package.json').version
  });
});
```

### Structured Logging

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'repo-dependency-graph' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### Metrics Collection

```javascript
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const analysisCounter = new prometheus.Counter({
  name: 'analysis_total',
  help: 'Total number of analyses performed',
  labelNames: ['status']
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
});
```

## 🔒 Security Considerations

### Input Validation

```javascript
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Security middleware
app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Path validation
function validatePath(path) {
  // Prevent directory traversal
  if (path.includes('..') || path.includes('~')) {
    throw new Error('Invalid path');
  }
  
  // Ensure path is within allowed directories
  const allowedPaths = ['/projects', '/tmp/analysis'];
  if (!allowedPaths.some(allowed => path.startsWith(allowed))) {
    throw new Error('Path not allowed');
  }
  
  return path;
}
```

### File System Security

```javascript
const fs = require('fs').promises;
const path = require('path');

async function secureFileAccess(filePath) {
  try {
    // Resolve and validate path
    const resolvedPath = path.resolve(filePath);
    const stats = await fs.stat(resolvedPath);
    
    // Check file size
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error('File too large');
    }
    
    // Check file type
    const ext = path.extname(resolvedPath);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error('File type not allowed');
    }
    
    return resolvedPath;
  } catch (error) {
    throw new Error(`File access denied: ${error.message}`);
  }
}
```

## 📈 Performance Optimization

### Caching Strategy

```javascript
const Redis = require('redis');
const client = Redis.createClient();

class AnalysisCache {
  constructor() {
    this.ttl = 3600; // 1 hour
  }
  
  async get(key) {
    try {
      const cached = await client.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  async set(key, value) {
    try {
      await client.setex(key, this.ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }
  
  generateKey(repoPath, options) {
    const crypto = require('crypto');
    const data = JSON.stringify({ repoPath, options });
    return crypto.createHash('md5').update(data).digest('hex');
  }
}
```

### Load Balancing

```javascript
// cluster.js
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // Workers can share any TCP port
  require('./server.js');
  console.log(`Worker ${process.pid} started`);
}
```

## 🚨 Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Monitor memory
   node --max-old-space-size=4096 server.js
   
   # Enable garbage collection logs
   node --trace-gc server.js
   ```

2. **Slow Analysis**
   ```javascript
   // Optimize file scanning
   const config = {
     maxFileSize: 1048576, // 1MB limit
     excludePatterns: [
       'node_modules/**',
       '*.min.js',
       'dist/**'
     ]
   };
   ```

3. **CORS Issues**
   ```javascript
   const cors = require('cors');
   app.use(cors({
     origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
     credentials: true
   }));
   ```

### Log Analysis

```bash
# View error logs
tail -f logs/error.log

# Search for specific errors
grep "ParseError" logs/combined.log

# Monitor real-time logs
pm2 logs repo-dependency-graph --lines 100
```

## 📋 Deployment Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Firewall rules configured
- [ ] Monitoring setup (health checks, metrics)
- [ ] Log rotation configured
- [ ] Backup strategy implemented
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] CORS policy set
- [ ] Error tracking setup
- [ ] Performance monitoring enabled
- [ ] Documentation updated

## 🔄 Updates & Maintenance

### Automated Updates

```bash
#!/bin/bash
# update.sh

# Pull latest changes
git pull origin main

# Install dependencies
npm ci

# Run tests
npm test

# Restart service
pm2 restart repo-dependency-graph

# Verify deployment
curl -f http://localhost:3000/health || exit 1

echo "Deployment successful"
```

### Database Migrations

```javascript
// migrations/001_add_analysis_history.js
module.exports = {
  up: async (db) => {
    await db.createCollection('analysis_history');
    await db.collection('analysis_history').createIndex({ timestamp: -1 });
  },
  
  down: async (db) => {
    await db.dropCollection('analysis_history');
  }
};
```

This deployment guide provides comprehensive instructions for production deployment, monitoring, and maintenance of the Repository Dependency Graph tool.