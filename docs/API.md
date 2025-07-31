# API Documentation

## Table of Contents

- [Core Classes](#core-classes)
- [Parsers](#parsers)
- [Utilities](#utilities)
- [Configuration](#configuration)
- [Examples](#examples)

## Core Classes

### DependencyAnalyzer

Main class for analyzing repository dependencies.

```javascript
const { DependencyAnalyzer } = require('./src/analyzer/dependency-analyzer');

const analyzer = new DependencyAnalyzer(config, logger);
const result = await analyzer.analyze('/path/to/repo');
```

#### Methods

##### `analyze(repositoryPath)`

Analyzes a repository and returns dependency graph data.

**Parameters:**
- `repositoryPath` (string): Path to the repository to analyze

**Returns:**
- `Promise<Object>`: Analysis result with nodes, edges, and metadata

**Example:**
```javascript
const result = await analyzer.analyze('./my-project');
console.log(`Found ${result.nodes.length} files and ${result.edges.length} dependencies`);
```

### Application

Main application class that orchestrates the analysis process.

```javascript
const { Application } = require('./src/index');

const app = new Application();
await app.run();
```

## Parsers

### BaseParser

Abstract base class for all language parsers.

```javascript
const { BaseParser } = require('./src/parsers/base-parser');

class MyParser extends BaseParser {
  constructor(config) {
    super(config);
    this.extensions = ['.myext'];
    this.name = 'MyParser';
  }
}
```

### JavaScriptParser

Parses JavaScript, JSX, and basic TypeScript files.

**Supported patterns:**
- ES6 imports: `import { foo } from 'bar'`
- CommonJS requires: `require('module')`
- Dynamic imports: `import('module')`
- AMD requires: `require(['deps'], callback)`

### PythonParser

Parses Python files for import statements.

**Supported patterns:**
- Standard imports: `import module`
- From imports: `from module import item`
- Relative imports: `from .module import item`

## Utilities

### Logger

Structured logging utility with multiple levels.

```javascript
const { Logger } = require('./src/utils/logger');

const logger = new Logger({
  level: 'info',
  format: 'json'
});

logger.info('Analysis started', { repository: '/path/to/repo' });
logger.error('Parse error', { file: 'bad.js', error: 'Syntax error' });
```

### FileScanner

Scans directories for files matching specified patterns.

```javascript
const { FileScanner } = require('./src/utils/file-scanner');

const scanner = new FileScanner({
  extensions: ['.js', '.py'],
  excludePatterns: ['node_modules/**', '*.test.js']
});

const files = await scanner.scanDirectory('/path/to/repo');
```

### CacheManager

Manages caching of analysis results for improved performance.

```javascript
const { CacheManager } = require('./src/utils/cache-manager');

const cache = new CacheManager({
  enabled: true,
  ttl: 3600000 // 1 hour
});

const cached = await cache.get('analysis-key');
if (!cached) {
  const result = await performAnalysis();
  await cache.set('analysis-key', result);
}
```

## Configuration

### ConfigManager

Loads and manages configuration from multiple sources.

```javascript
const { ConfigManager } = require('./src/config/config-manager');

const configManager = new ConfigManager();
const config = await configManager.loadConfig('/path/to/repo', cliOptions);
```

### Configuration Options

```javascript
{
  // Repository settings
  repositoryPath: '/path/to/repo',
  outputFile: 'network-data.json',
  
  // Analysis options
  includeExternal: false,
  maxFileSize: 1048576, // 1MB
  excludePatterns: ['node_modules/**', 'dist/**'],
  
  // Output options
  format: 'json', // 'json' or 'js'
  quiet: false,
  verbose: false,
  
  // Performance options
  cache: {
    enabled: true,
    ttl: 3600000
  },
  
  // Logging options
  logging: {
    level: 'info',
    format: 'text'
  }
}
```

## Examples

### Basic Analysis

```javascript
const { DependencyAnalyzer } = require('./src/analyzer/dependency-analyzer');
const { Logger } = require('./src/utils/logger');

async function analyzeProject(projectPath) {
  const logger = new Logger({ level: 'info' });
  const config = {
    repositoryPath: projectPath,
    includeExternal: false,
    outputFile: 'dependencies.json'
  };
  
  const analyzer = new DependencyAnalyzer(config, logger);
  const result = await analyzer.analyze(projectPath);
  
  console.log(`Analysis complete:`);
  console.log(`- Files: ${result.nodes.length}`);
  console.log(`- Dependencies: ${result.edges.length}`);
  console.log(`- External: ${result.metadata.externalDependencies}`);
  
  return result;
}
```

### Custom Parser

```javascript
const { BaseParser } = require('./src/parsers/base-parser');

class GoParser extends BaseParser {
  constructor(config = {}) {
    super(config);
    this.extensions = ['.go'];
    this.name = 'GoParser';
    
    this.patterns = [
      {
        regex: /import\s+"([^"]+)"/g,
        moduleGroup: 1,
        type: 'import'
      },
      {
        regex: /import\s+\(\s*([^)]+)\s*\)/gs,
        moduleGroup: 1,
        type: 'import-block',
        transform: (dep, match) => {
          // Parse import block
          const imports = match[1]
            .split('\n')
            .map(line => line.trim().replace(/"/g, ''))
            .filter(line => line && !line.startsWith('//'));
          dep.modules = imports;
          dep.module = imports[0];
        }
      }
    ];
  }
  
  async parse(file, content) {
    // Custom parsing logic
    const dependencies = this.extractDependencies(content);
    
    return {
      file: file,
      dependencies: dependencies.map(dep => ({
        ...dep,
        ...this.resolveModulePath(dep.module, file.path),
        parser: this.name
      })),
      metadata: {
        parser: this.name,
        totalDependencies: dependencies.length
      }
    };
  }
}

module.exports = { GoParser };
```

### CLI Integration

```javascript
const { CLIHandler } = require('./src/cli/cli-handler');

const cli = new CLIHandler();
const options = cli.parse(process.argv);

if (options.help) {
  cli.showHelp();
  process.exit(0);
}

const errors = cli.validateArgs(options);
if (errors.length > 0) {
  console.error('Validation errors:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
```

## Error Handling

### ErrorHandler

Centralized error handling with logging and recovery strategies.

```javascript
const { ErrorHandler } = require('./src/utils/error-handler');

const errorHandler = new ErrorHandler(logger);

try {
  await riskyOperation();
} catch (error) {
  await errorHandler.handleError(error, {
    context: 'file-parsing',
    file: 'problematic.js'
  });
}
```

### Common Error Types

- `ParseError`: File parsing failures
- `ValidationError`: Input validation failures
- `ConfigurationError`: Configuration loading issues
- `FileSystemError`: File access problems

## Performance Considerations

### Large Repositories

For repositories with 1000+ files:

1. **Enable caching**: Set `cache.enabled: true`
2. **Increase file size limits**: Adjust `maxFileSize` as needed
3. **Use exclusion patterns**: Skip unnecessary directories
4. **Consider chunked processing**: Process subdirectories separately

### Memory Usage

The analyzer is designed to handle large codebases efficiently:

- Streaming file processing
- Lazy loading of parsers
- Garbage collection friendly patterns
- Configurable memory limits

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on extending the API and adding new features.