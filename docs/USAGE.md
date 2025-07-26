# Usage Guide

## 🚀 Getting Started

### Method 1: Standalone Mode (Recommended for Quick Testing)
1. Open `public/index.html` directly in your browser
2. Click "Load Sample Data" to see the visualization with proper node spacing
3. Upload your own JSON files using "Upload JSON File" button

### Method 2: Server Mode (Full Functionality)
```bash
# Start the server
node server.js

# Open browser and navigate to
http://localhost:3000
```

## 📊 Visualization Features

### Fixed Node Spacing Issues
- ✅ Nodes no longer collapse onto each other
- ✅ Strong repulsion forces keep nodes properly spaced
- ✅ Improved physics configuration for better layouts
- ✅ Visual progress indicator during network stabilization

### Interactive Controls
- **Load Sample Data**: See demo visualization
- **Upload JSON File**: Load your own dependency data
- **Analyze Repository**: Use backend to analyze current directory
- **Reset View**: Fit graph to screen
- **Export PNG**: Save visualization as image

### Node Types & Colors
- 🟡 **JavaScript** (.js files)
- 🔵 **React JSX** (.jsx files) 
- 🔷 **TypeScript** (.ts files)
- 🐍 **Python** (.py files)
- 🔴 **External** (node_modules, external dependencies)
- 🟠 **Missing** (unresolved dependencies)

## 🔧 CLI Usage

### Analyze a Repository
```bash
# Analyze current directory
node analyze_dependencies.js

# Analyze specific directory
node analyze_dependencies.js /path/to/project

# Use as global command (after npm install -g)
repo-graph /path/to/project
```

### Output Files
- `network-data.json`: Network data for visualization
- `dependency_graph.html`: Standalone HTML file (legacy)

## 📁 Data Format

The tool expects JSON data in this format:

```json
{
  "nodes": [
    {
      "id": 1,
      "label": "main.js",
      "path": "src/main.js", 
      "type": "javascript",
      "dependencies": 5,
      "external": false
    }
  ],
  "edges": [
    {
      "from": 1,
      "to": 2,
      "dependency": "utils.js"
    }
  ]
}
```

## 🎯 Tips for Best Results

1. **Large Projects**: The visualization works best with 50-200 nodes
2. **Performance**: For very large codebases, consider filtering by file type
3. **Spacing**: If nodes still seem too close, try the "Reset View" button
4. **Export**: Use PNG export for documentation and presentations

## 🐛 Troubleshooting

### Nodes Collapsing
- This should be fixed in the current version
- If still occurring, try refreshing the page and loading data again

### CORS Errors
- Use server mode (`node server.js`) instead of opening HTML directly
- Or use the standalone mode which handles file uploads

### Large Files
- For repositories with 500+ files, analysis may take longer
- Consider using filters or analyzing subdirectories