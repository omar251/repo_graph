# Contributing to Repository Dependency Graph

Thank you for your interest in contributing to the Repository Dependency Graph project! 🎉

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Development Workflow](#development-workflow)

## 🤝 Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please be respectful, inclusive, and constructive in all interactions.

## 🚀 Getting Started

### Prerequisites

- Node.js 14.0.0 or higher
- npm or yarn package manager
- Git

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/repo-dependency-graph.git
   cd repo-dependency-graph
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Tests**
   ```bash
   npm test
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📝 Contributing Guidelines

### Types of Contributions

We welcome the following types of contributions:

- 🐛 **Bug fixes**
- ✨ **New features**
- 📚 **Documentation improvements**
- 🧪 **Test coverage improvements**
- 🎨 **UI/UX enhancements**
- ⚡ **Performance optimizations**
- 🌐 **Language parser additions**

### Coding Standards

- **JavaScript**: Follow ES6+ standards with proper error handling
- **Code Style**: Use consistent indentation (2 spaces) and meaningful variable names
- **Comments**: Add JSDoc comments for public functions and complex logic
- **Testing**: Write tests for new features and bug fixes
- **Commits**: Use conventional commit messages

### Conventional Commits

Use the following format for commit messages:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(parser): add support for TypeScript decorators
fix(analyzer): resolve circular dependency detection issue
docs(readme): update installation instructions
test(parser): add edge case tests for import resolution
```

## 🔄 Pull Request Process

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write clean, well-documented code
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   npm test
   npm run lint
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat(scope): your descriptive message"
   ```

5. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**
   - Use a descriptive title
   - Fill out the PR template completely
   - Link related issues
   - Request review from maintainers

### Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review of code completed
- [ ] Tests added for new functionality
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
- [ ] Commit messages follow conventional format

## 🐛 Issue Reporting

### Bug Reports

When reporting bugs, please include:

- **Environment**: OS, Node.js version, npm version
- **Steps to Reproduce**: Clear, numbered steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Screenshots**: If applicable
- **Sample Code**: Minimal reproduction case

### Feature Requests

For feature requests, please provide:

- **Problem Description**: What problem does this solve?
- **Proposed Solution**: How should it work?
- **Alternatives Considered**: Other approaches you've thought about
- **Use Cases**: Real-world scenarios where this would be useful

## 🛠️ Development Workflow

### Project Structure

```
repo-dependency-graph/
├── src/                    # Source code
│   ├── analyzer/          # Dependency analysis logic
│   ├── cli/              # Command-line interface
│   ├── config/           # Configuration management
│   ├── output/           # Output formatting
│   ├── parsers/          # Language parsers
│   ├── security/         # Input validation
│   └── utils/            # Utility functions
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── examples/             # Example projects
├── docs/                 # Documentation
└── public/               # Web interface files
```

### Adding a New Language Parser

1. **Create Parser Class**
   ```javascript
   // src/parsers/your-language-parser.js
   const { BaseParser } = require('./base-parser');
   
   class YourLanguageParser extends BaseParser {
     constructor(config = {}) {
       super(config);
       this.extensions = ['.ext'];
       this.name = 'YourLanguageParser';
       // Define regex patterns for dependency extraction
     }
   }
   ```

2. **Register Parser**
   ```javascript
   // src/parsers/parser-registry.js
   const { YourLanguageParser } = require('./your-language-parser');
   // Add to registry
   ```

3. **Add Tests**
   ```javascript
   // tests/unit/parsers/your-language-parser.test.js
   // Write comprehensive tests
   ```

4. **Update Documentation**
   - Add to supported languages list
   - Update examples if needed

### Testing Guidelines

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test complete workflows
- **Edge Cases**: Test error conditions and edge cases
- **Performance Tests**: For large file processing

### Documentation Standards

- **README**: Keep up-to-date with latest features
- **API Docs**: Document all public functions
- **Examples**: Provide working code examples
- **Changelog**: Document all changes

## 🎯 Areas for Contribution

### High Priority

- [ ] Additional language parsers (Go, Rust, Java, C#)
- [ ] Circular dependency detection
- [ ] Performance optimizations for large codebases
- [ ] Advanced visualization features

### Medium Priority

- [ ] Plugin system for custom analyzers
- [ ] Database storage for historical analysis
- [ ] REST API endpoints
- [ ] IDE integrations

### Low Priority

- [ ] Machine learning insights
- [ ] Cloud-based analysis
- [ ] Team collaboration features
- [ ] Advanced metrics and reporting

## 📞 Getting Help

- **Documentation**: Check the [docs/](docs/) directory
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Discord**: Join our community Discord server (link in README)

## 🙏 Recognition

Contributors will be recognized in:

- README.md contributors section
- Release notes for significant contributions
- Annual contributor highlights

Thank you for contributing to Repository Dependency Graph! 🚀