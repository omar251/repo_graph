# Repository Dependency Graph

A powerful tool for analyzing and visualizing code dependencies in JavaScript and Python projects. Generate interactive network graphs to understand your codebase structure and identify dependency patterns.

![Dependency Graph Example](https://img.shields.io/badge/Status-Active-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-14%2B-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

🔍 **Multi-language Support**: Analyze JavaScript and Python codebases  
📊 **Interactive Visualization**: Beautiful network graphs with vis.js  
🎯 **Smart Path Resolution**: Handles relative imports and module paths  
⚡ **Fast Analysis**: Efficient file parsing and dependency extraction  
🎨 **Customizable Display**: Configurable graph physics and styling  
📱 **Responsive Design**: Works on desktop and mobile browsers  

## Installation

### Prerequisites
- Node.js 14.0 or higher
- Python 3.6+ (for serving the visualization)

### Quick Start
```bash
# Clone the repository
git clone <repository-url>
cd repo-dependency-graph

# Install dependencies (if any)
npm install

# Make the script executable (optional)
chmod +x analyze_dependencies.js
```

## Usage

### Basic Usage
```bash
# Analyze a repository and generate visualization data
node analyze_dependencies.js /path/to/your/repository

# Or if you made it executable
./analyze_dependencies.js /path/to/your/repository
```

### View the Visualization
```bash
# Start a local server (Python 3)
python -m http.server 8000

# Or Python 2
python -m SimpleHTTPServer 8000

# Open http://localhost:8000/dependency_graph.html in your browser
```

### NPM Scripts
```bash
# Using package.json scripts
npm run analyze /path/to/repo
npm run serve
```

## Supported Languages & Patterns

### JavaScript
- **CommonJS**: `require('./module')`, `require('../utils')`
- **Relative imports**: `./`, `../` path resolution
- **File extensions**: `.js` files

### Python  
- **Import statements**: `import module`, `import package.submodule`
- **From imports**: `from package import module`
- **Relative imports**: `from .module import function`, `from ..package import class`
- **File extensions**: `.py` files

## Output Format

The tool generates `network-data.json` containing:

```json
{
  "nodes": [
    {
      "id": 0,
      "label": "filename.py",
      "path": "/full/path/to/file.py"
    }
  ],
  "edges": [
    {
      "from": 0,
      "to": 1
    }
  ]
}
```

## Examples

### Analyzing a Python Project
```bash
node analyze_dependencies.js ~/projects/my-python-app/src
```

### Analyzing a JavaScript Project
```bash
node analyze_dependencies.js ~/projects/my-js-app/src
```

### Sample Output Structure
```
Repository: my-project/
├── main.py          (imports: utils, config)
├── utils.py         (imports: logging_helper)  
├── config.py        (imports: none)
└── logging_helper.py (imports: none)

Generated Graph:
main.py → utils.py
main.py → config.py  
utils.py → logging_helper.py
```

## Visualization Features

### Interactive Controls
- **Pan & Zoom**: Navigate large dependency graphs
- **Physics Simulation**: Automatic layout with force-directed positioning
- **Node Highlighting**: Click nodes to see connections
- **Responsive Design**: Adapts to screen size

### Graph Configuration
The visualization uses optimized physics settings:
- Force-based layout for clear separation
- Stabilization for consistent positioning
- Customizable node sizes and edge styles

## File Structure

```
repo-dependency-graph/
├── analyze_dependencies.js   # Main analysis script
├── dependency_graph.html     # Visualization interface  
├── network-data.json        # Generated graph data
├── package.json             # Node.js configuration
├── README.md               # This file
└── .gitignore              # Git ignore rules
```

## Limitations

- **Language Support**: Currently limited to JavaScript and Python
- **Import Patterns**: May not catch all dynamic import patterns
- **Large Codebases**: Performance may vary with very large repositories
- **External Dependencies**: Only analyzes local file dependencies

## Roadmap

- [ ] TypeScript support (.ts, .tsx files)
- [ ] ES6 import/export syntax
- [ ] JSX support (.jsx files)
- [ ] Configuration file support
- [ ] CLI argument parsing
- [ ] Graph filtering and search
- [ ] Export formats (PNG, SVG, PDF)
- [ ] Dependency cycle detection
- [ ] Performance optimizations

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Test with both JavaScript and Python projects

## Troubleshooting

### Common Issues

**"Please provide a path to the repository"**
- Ensure you're passing a repository path as an argument
- Example: `node analyze_dependencies.js /path/to/repo`

**Empty or minimal graph**
- Check that the repository contains .js or .py files
- Verify the path points to the source directory
- Ensure files have proper import/require statements

**Visualization not loading**
- Make sure `network-data.json` was generated successfully
- Check that you're serving the files via HTTP (not file://)
- Verify your browser supports modern JavaScript

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [vis.js](https://visjs.org/) for the excellent network visualization library
- Inspired by various dependency analysis tools in the ecosystem

---

**Happy Dependency Mapping!** 🗺️✨