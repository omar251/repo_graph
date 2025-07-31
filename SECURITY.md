# Security Policy

## 🔒 Supported Versions

We actively support security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | ✅ Yes             |
| 1.x.x   | ❌ No              |

## 🚨 Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### 1. **Do NOT** create a public GitHub issue

Security vulnerabilities should not be reported publicly until they have been addressed.

### 2. Send a private report

Email us at: **security@your-domain.com** (replace with actual email)

Include the following information:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (if available)

### 3. Response Timeline

- **Initial Response**: Within 24 hours
- **Vulnerability Assessment**: Within 72 hours
- **Fix Development**: 1-2 weeks (depending on severity)
- **Public Disclosure**: After fix is released and users have time to update

## 🛡️ Security Measures

### Input Validation

The application implements comprehensive input validation:

```javascript
// Path sanitization
function validatePath(inputPath) {
  // Prevent directory traversal
  if (inputPath.includes('..') || inputPath.includes('~')) {
    throw new SecurityError('Invalid path detected');
  }
  
  // Ensure path is within allowed boundaries
  const resolved = path.resolve(inputPath);
  if (!isWithinAllowedDirectory(resolved)) {
    throw new SecurityError('Path outside allowed directories');
  }
  
  return resolved;
}
```

### File Size Limits

```javascript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES_PER_ANALYSIS = 10000;

function validateFileSize(filePath) {
  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new SecurityError('File exceeds maximum size limit');
  }
}
```

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 analysis requests per windowMs
  message: 'Too many analysis requests, please try again later'
});
```

### Content Security Policy

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));
```

## 🔍 Security Best Practices

### For Users

1. **Keep Updated**: Always use the latest version
2. **Validate Inputs**: Don't analyze untrusted repositories without review
3. **Network Security**: Use HTTPS when deploying the web interface
4. **Access Control**: Implement proper authentication for production deployments
5. **Environment Variables**: Store sensitive configuration in environment variables

### For Developers

1. **Code Review**: All changes require security review
2. **Dependency Scanning**: Regular dependency vulnerability scans
3. **Static Analysis**: Use ESLint security rules
4. **Input Sanitization**: Validate all user inputs
5. **Error Handling**: Don't expose sensitive information in error messages

## 🚫 Known Security Considerations

### File System Access

The tool requires file system access to analyze repositories. Consider these risks:

- **Directory Traversal**: Mitigated by path validation
- **Symbolic Links**: Handled with careful path resolution
- **Large Files**: Protected by file size limits
- **Binary Files**: Automatically excluded from analysis

### Web Interface

When using the web interface:

- **CORS**: Configure appropriate CORS policies
- **Authentication**: Implement authentication for production use
- **HTTPS**: Always use HTTPS in production
- **Session Management**: Implement secure session handling

### Command Line Interface

- **Argument Injection**: All CLI arguments are validated
- **Path Injection**: Paths are sanitized and validated
- **Resource Exhaustion**: Protected by limits and timeouts

## 🔧 Security Configuration

### Production Security Checklist

- [ ] Enable HTTPS with valid certificates
- [ ] Configure proper CORS policies
- [ ] Implement rate limiting
- [ ] Set up proper logging and monitoring
- [ ] Configure file size and count limits
- [ ] Enable security headers (helmet.js)
- [ ] Implement input validation
- [ ] Set up error handling that doesn't leak information
- [ ] Configure proper authentication/authorization
- [ ] Regular security updates and dependency scanning

### Environment Variables

```bash
# Security settings
ENABLE_HTTPS=true
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# File limits
MAX_FILE_SIZE=5242880        # 5MB
MAX_FILES_PER_ANALYSIS=10000

# CORS
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true

# Logging
LOG_LEVEL=info
LOG_SECURITY_EVENTS=true
```

### Secure Headers Configuration

```javascript
app.use(helmet({
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  
  // Prevent MIME type sniffing
  noSniff: true,
  
  // Enable XSS protection
  xssFilter: true,
  
  // Enforce HTTPS
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  
  // Prevent information disclosure
  hidePoweredBy: true,
  
  // Referrer policy
  referrerPolicy: { policy: 'same-origin' }
}));
```

## 🔐 Encryption and Data Protection

### Data at Rest

- Configuration files should be encrypted if they contain sensitive data
- Analysis results can be encrypted using:

```javascript
const crypto = require('crypto');

function encryptAnalysisResult(data, key) {
  const cipher = crypto.createCipher('aes-256-cbc', key);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}
```

### Data in Transit

- Always use HTTPS for web deployments
- Validate SSL certificates
- Implement certificate pinning for high-security environments

## 📊 Security Monitoring

### Logging Security Events

```javascript
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'security.log' })
  ]
});

// Log security events
function logSecurityEvent(event, details) {
  securityLogger.warn('Security Event', {
    event,
    details,
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
}
```

### Metrics to Monitor

- Failed authentication attempts
- Unusual file access patterns
- Rate limit violations
- Large file upload attempts
- Directory traversal attempts
- Suspicious user agents

## 🚨 Incident Response

### Security Incident Procedure

1. **Detection**: Monitor logs and alerts
2. **Assessment**: Determine severity and impact
3. **Containment**: Isolate affected systems
4. **Investigation**: Analyze the incident
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Update security measures

### Emergency Contacts

- **Security Team**: security@your-domain.com
- **Development Team**: dev@your-domain.com
- **Operations Team**: ops@your-domain.com

## 📋 Security Audit

### Regular Security Reviews

- **Monthly**: Dependency vulnerability scans
- **Quarterly**: Code security reviews
- **Annually**: Full security audits

### Tools and Processes

```bash
# Dependency scanning
npm audit
npm audit fix

# Security linting
eslint --ext .js src/ --config .eslintrc-security.js

# SAST scanning
semgrep --config=auto src/

# Container scanning (if using Docker)
docker scan repo-dependency-graph:latest
```

## 📞 Contact Information

For security-related questions or concerns:

- **Email**: security@your-domain.com
- **PGP Key**: [Link to public key]
- **Response Time**: 24 hours for critical issues

---

**Remember**: Security is everyone's responsibility. If you see something, say something.