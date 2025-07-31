# Architecture Documentation

## 🏗️ System Overview

The Repository Dependency Graph is a modular, extensible tool designed for analyzing and visualizing code dependencies across multiple programming languages.

## 📊 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                     │
├─────────────────────────────────────────────────────────────┤
│  CLI Interface  │  Web Interface  │  REST API (Future)      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│  Application    │  CLI Handler   │  Config Manager          │
│  Orchestrator   │               │                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Core Analysis Layer                      │
├─────────────────────────────────────────────────────────────┤
│  Dependency     │  Graph Builder │  Parser Registry         │
│  Analyzer       │               │                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Parser Layer                             │
├─────────────────────────────────────────────────────────────┤
│  Base Parser    │  JS Parser     │  Python Parser           │
│                 │  (+ JSX, TS)   │                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Utility Layer                            │
├─────────────────────────────────────────────────────────────┤
│  File Scanner   │  Logger        │  Cache Manager           │
│  Error Handler  │  Validator     │  Output Formatter        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                            │
├─────────────────────────────────────────────────────────────┤
│  File System    │  Cache Store   │  Configuration Files     │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Core Components

### 1. Application Orchestrator (`src/index.js`)

**Responsibility**: Main entry point that coordinates the entire analysis process.

**Key Features**:
- CLI argument parsing
- Configuration loading
- Component initialization
- Error handling and recovery
- Result output coordination

### 2. Dependency Analyzer (`src/analyzer/dependency-analyzer.js`)

**Responsibility**: Core analysis engine that processes repositories.

**Key Features**:
- File discovery and filtering
- Parser coordination
- Dependency graph construction
- Metadata collection
- Performance optimization

### 3. Parser System (`src/parsers/`)

**Responsibility**: Language-specific dependency extraction.

**Architecture**:
```
BaseParser (Abstract)
├── JavaScriptParser (.js, .jsx, .mjs, .cjs)
├── PythonParser (.py)
└── [Future parsers...]
```

**Key Features**:
- Extensible parser registry
- Regex-based pattern matching
- Path resolution algorithms
- Import/export analysis

### 4. Configuration System (`src/config/`)

**Responsibility**: Centralized configuration management.

**Sources** (in priority order):
1. CLI arguments
2. Configuration files
3. Environment variables
4. Default values

### 5. Utility Layer (`src/utils/`)

**Components**:
- **FileScanner**: Efficient directory traversal with filtering
- **Logger**: Structured logging with multiple outputs
- **CacheManager**: Performance optimization through caching
- **ErrorHandler**: Centralized error handling and recovery

## 🔄 Data Flow

### Analysis Pipeline

```
Repository Path
       │
       ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ File        │───▶│ Parser       │───▶│ Dependency  │
│ Scanner     │    │ Selection    │    │ Extraction  │
└─────────────┘    └──────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ File List   │    │ Content      │    │ Raw         │
│ + Metadata  │    │ Analysis     │    │ Dependencies│
└─────────────┘    └──────────────┘    └─────────────┘
                                              │
                                              ▼
                                    ┌─────────────┐
                                    │ Path        │
                                    │ Resolution  │
                                    └─────────────┘
                                              │
                                              ▼
                                    ┌─────────────┐
                                    │ Graph       │
                                    │ Building    │
                                    └─────────────┘
                                              │
                                              ▼
                                    ┌─────────────┐
                                    │ Output      │
                                    │ Formatting  │
                                    └─────────────┘
```

### Data Structures

#### File Node
```javascript
{
  id: number,
  label: string,
  path: string,
  fullPath: string,
  type: string,
  size?: number,
  lastModified?: Date
}
```

#### Dependency Edge
```javascript
{
  from: number,
  to: number,
  dependency: string,
  type: 'import' | 'require' | 'dynamic-import',
  line?: number
}
```

#### Analysis Result
```javascript
{
  nodes: FileNode[],
  edges: DependencyEdge[],
  metadata: {
    analysisTime: number,
    totalFiles: number,
    totalDependencies: number,
    externalDependencies: number,
    errors: Error[],
    timestamp: Date
  }
}
```

## 🎯 Design Patterns

### 1. Strategy Pattern (Parsers)

Each language parser implements the same interface but with different parsing strategies:

```javascript
class BaseParser {
  async parse(file, content) {
    // Template method
    const cleaned = this.removeComments(content);
    const deps = this.extractDependencies(cleaned);
    return this.formatResult(file, deps);
  }
  
  // Strategy methods (implemented by subclasses)
  extractDependencies(content) { throw new Error('Not implemented'); }
}
```

### 2. Registry Pattern (Parser Management)

Dynamic parser registration and selection:

```javascript
class ParserRegistry {
  register(parser) {
    this.parsers.set(parser.name, parser);
  }
  
  getParser(fileExtension) {
    return this.parsers.find(p => p.supports(fileExtension));
  }
}
```

### 3. Builder Pattern (Graph Construction)

Step-by-step graph building with validation:

```javascript
class GraphBuilder {
  addNode(file) { return this; }
  addEdge(from, to, dependency) { return this; }
  validate() { return this; }
  build() { return this.graph; }
}
```

### 4. Observer Pattern (Logging)

Event-driven logging throughout the system:

```javascript
class Logger {
  info(message, context) {
    this.emit('log', { level: 'info', message, context });
  }
}
```

## 🚀 Performance Considerations

### 1. File Processing

- **Streaming**: Large files processed in chunks
- **Filtering**: Early exclusion of unnecessary files
- **Parallel Processing**: Multiple files analyzed concurrently
- **Memory Management**: Garbage collection friendly patterns

### 2. Caching Strategy

```
Cache Key = hash(repositoryPath + options + fileModificationTimes)
Cache TTL = 1 hour (configurable)
Cache Storage = Memory (with Redis option)
```

### 3. Optimization Techniques

- **Lazy Loading**: Parsers loaded on demand
- **Memoization**: Path resolution results cached
- **Debouncing**: File system watch events
- **Circuit Breaker**: Automatic failure recovery

## 🔒 Security Architecture

### 1. Input Validation

```javascript
// Path sanitization
function sanitizePath(path) {
  // Prevent directory traversal
  if (path.includes('..')) throw new SecurityError();
  
  // Validate against whitelist
  if (!isAllowedPath(path)) throw new SecurityError();
  
  return path.normalize();
}
```

### 2. Resource Limits

- **File Size**: Maximum 5MB per file
- **Memory**: Configurable heap limits
- **Time**: Analysis timeout protection
- **Concurrency**: Limited parallel operations

### 3. Error Handling

```javascript
class SecurityError extends Error {
  constructor(message, context) {
    super(message);
    this.name = 'SecurityError';
    this.context = context;
    this.timestamp = new Date();
  }
}
```

## 🔧 Extensibility Points

### 1. Adding New Language Parsers

```javascript
// 1. Create parser class
class NewLanguageParser extends BaseParser {
  constructor() {
    super();
    this.extensions = ['.newlang'];
    this.patterns = [/* regex patterns */];
  }
}

// 2. Register parser
parserRegistry.register(new NewLanguageParser());
```

### 2. Custom Output Formats

```javascript
class CustomFormatter extends BaseFormatter {
  format(analysisResult) {
    // Custom formatting logic
    return customFormat;
  }
}
```

### 3. Plugin System (Future)

```javascript
class PluginManager {
  loadPlugin(pluginPath) {
    const plugin = require(pluginPath);
    this.registerHooks(plugin.hooks);
  }
  
  executeHook(hookName, data) {
    return this.hooks[hookName].reduce((acc, fn) => fn(acc), data);
  }
}
```

## 📊 Monitoring & Observability

### 1. Metrics Collection

- **Analysis Performance**: Time, memory usage, file counts
- **Error Rates**: Parse failures, validation errors
- **Usage Patterns**: Most analyzed languages, file types
- **System Health**: Memory, CPU, disk usage

### 2. Logging Strategy

```javascript
// Structured logging with context
logger.info('Analysis started', {
  repository: '/path/to/repo',
  options: { includeExternal: false },
  requestId: 'uuid-here'
});
```

### 3. Health Checks

```javascript
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    checks: {
      memory: checkMemoryUsage(),
      disk: checkDiskSpace(),
      parsers: checkParsersLoaded()
    }
  };
  
  res.json(health);
});
```

## 🔄 Future Architecture Considerations

### 1. Microservices Migration

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Gateway   │  │  Analysis   │  │ Visualization│
│   Service   │──│   Service   │──│   Service    │
└─────────────┘  └─────────────┘  └─────────────┘
       │                │                │
       ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Config    │  │   Parser    │  │   Storage   │
│   Service   │  │   Service   │  │   Service   │
└─────────────┘  └─────────────┘  └─────────────┘
```

### 2. Event-Driven Architecture

```javascript
// Event bus for loose coupling
eventBus.emit('file.discovered', { file, metadata });
eventBus.emit('dependency.found', { from, to, type });
eventBus.emit('analysis.completed', { result, metrics });
```

### 3. Distributed Processing

```javascript
// Queue-based processing for large repositories
const analysisQueue = new Queue('analysis', {
  redis: { host: 'redis-server' }
});

analysisQueue.process('analyze-file', async (job) => {
  const { file, options } = job.data;
  return await analyzeFile(file, options);
});
```

This architecture provides a solid foundation for current needs while maintaining flexibility for future enhancements and scaling requirements.