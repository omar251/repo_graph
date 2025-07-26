/**
 * Output Formatter
 * Handles formatting and writing analysis results to various output formats
 */

const fs = require('fs').promises;
const path = require('path');

class OutputFormatter {
    constructor(config = {}, logger) {
        this.config = {
            format: config.outputFormat || 'json',
            prettify: config.prettify !== false,
            includeMetadata: config.includeMetadata !== false,
            ...config
        };
        this.logger = logger;
    }

    async writeResults(result, outputPath) {
        try {
            this.logger.info('Writing analysis results', {
                outputPath,
                format: this.config.format,
                nodes: result.nodes.length,
                edges: result.edges.length
            });

            // Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            await fs.mkdir(outputDir, { recursive: true });

            // Format and write based on output format
            switch (this.config.format) {
                case 'json':
                    await this.writeJSON(result, outputPath);
                    break;
                case 'js':
                    await this.writeJavaScript(result, outputPath);
                    break;
                default:
                    throw new Error(`Unsupported output format: ${this.config.format}`);
            }

            this.logger.info('Results written successfully', { outputPath });

        } catch (error) {
            this.logger.error('Failed to write results', {
                outputPath,
                error: error.message
            });
            throw error;
        }
    }

    async writeJSON(result, outputPath) {
        const formattedResult = this.formatResult(result);
        const jsonContent = this.config.prettify 
            ? JSON.stringify(formattedResult, null, 2)
            : JSON.stringify(formattedResult);

        await fs.writeFile(outputPath, jsonContent, 'utf8');
    }

    async writeJavaScript(result, outputPath) {
        const formattedResult = this.formatResult(result);
        const jsonContent = this.config.prettify 
            ? JSON.stringify(formattedResult, null, 2)
            : JSON.stringify(formattedResult);

        const jsContent = `// Dependency Graph Data
// Generated on ${new Date().toISOString()}
// Total nodes: ${result.nodes.length}, Total edges: ${result.edges.length}

const networkData = ${jsonContent};

// For browser usage
if (typeof window !== 'undefined') {
    window.networkData = networkData;
}

// For Node.js usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = networkData;
}
`;

        await fs.writeFile(outputPath, jsContent, 'utf8');
    }

    formatResult(result) {
        const formatted = {
            nodes: this.formatNodes(result.nodes),
            edges: this.formatEdges(result.edges)
        };

        if (this.config.includeMetadata && result.metadata) {
            formatted.metadata = this.formatMetadata(result.metadata);
        }

        return formatted;
    }

    formatNodes(nodes) {
        return nodes.map(node => {
            const formatted = {
                id: node.id,
                label: node.label,
                path: node.path,
                type: node.type
            };

            // Add visual properties based on node type
            this.addNodeVisualProperties(formatted, node);

            // Add optional properties
            if (node.fullPath) formatted.fullPath = node.fullPath;
            if (node.extension) formatted.extension = node.extension;
            if (node.size !== undefined) formatted.size = node.size;
            if (node.dependencies !== undefined) formatted.dependencies = node.dependencies;
            if (node.parser) formatted.parser = node.parser;
            if (node.isExternal) formatted.isExternal = node.isExternal;
            if (node.isMissing) formatted.isMissing = node.isMissing;
            if (node.package) formatted.package = node.package;

            return formatted;
        });
    }

    addNodeVisualProperties(formatted, node) {
        // Color coding based on file type
        const colors = {
            javascript: '#f7df1e',    // JavaScript yellow
            typescript: '#3178c6',    // TypeScript blue
            python: '#3776ab',        // Python blue
            json: '#000000',          // JSON black
            external: '#607d8b',      // External grey
            missing: '#f44336',       // Missing red
            unknown: '#9e9e9e'        // Unknown grey
        };

        formatted.color = {
            background: colors[node.type] || colors.unknown,
            border: this.darkenColor(colors[node.type] || colors.unknown),
            highlight: {
                background: this.lightenColor(colors[node.type] || colors.unknown),
                border: colors[node.type] || colors.unknown
            }
        };

        // Shape based on type
        const shapes = {
            javascript: 'dot',
            typescript: 'diamond',
            python: 'triangle',
            json: 'square',
            external: 'star',
            missing: 'triangleDown'
        };

        formatted.shape = shapes[node.type] || 'dot';

        // Size based on dependencies or file size
        const baseSize = 20;
        const sizeMultiplier = Math.min(Math.max(node.dependencies || 1, 1), 10);
        formatted.size = baseSize + (sizeMultiplier * 2);

        // Font styling
        formatted.font = {
            size: 12,
            color: '#333333'
        };

        // Special styling for external and missing nodes
        if (node.isExternal) {
            formatted.borderWidth = 2;
            formatted.borderWidthSelected = 3;
        }

        if (node.isMissing) {
            formatted.opacity = 0.5;
            formatted.font.color = '#666666';
        }
    }

    formatEdges(edges) {
        return edges.map(edge => {
            const formatted = {
                from: edge.from,
                to: edge.to
            };

            // Add optional properties
            if (edge.label) formatted.label = edge.label;
            if (edge.type) formatted.type = edge.type;
            if (edge.importType) formatted.importType = edge.importType;
            if (edge.line) formatted.line = edge.line;
            if (edge.column) formatted.column = edge.column;

            // Add visual properties
            this.addEdgeVisualProperties(formatted, edge);

            return formatted;
        });
    }

    addEdgeVisualProperties(formatted, edge) {
        // Color coding based on dependency type
        const colors = {
            'import': '#2196f3',        // Blue
            'require': '#4caf50',       // Green
            'dynamic-import': '#ff9800', // Orange
            'from-import': '#9c27b0',   // Purple
            'relative-import': '#f44336', // Red
            'external': '#607d8b'       // Blue Grey
        };

        formatted.color = {
            color: colors[edge.type] || '#666666',
            highlight: colors[edge.type] || '#666666',
            hover: colors[edge.type] || '#666666'
        };

        // Line style based on import type
        if (edge.type === 'dynamic-import') {
            formatted.dashes = [5, 5];
        }

        // Arrow styling
        formatted.arrows = {
            to: {
                enabled: true,
                scaleFactor: 1,
                type: 'arrow'
            }
        };

        // Width based on importance (can be enhanced)
        formatted.width = 1;

        // Smooth curves for better visualization
        formatted.smooth = {
            type: 'continuous'
        };
    }

    formatMetadata(metadata) {
        const formatted = {
            timestamp: metadata.timestamp,
            version: metadata.version,
            analysisTime: metadata.analysisTime
        };

        if (metadata.repositoryPath) {
            formatted.repositoryPath = metadata.repositoryPath;
        }

        if (metadata.config) {
            formatted.config = {
                includeExternal: metadata.config.includeExternal,
                excludePatterns: metadata.config.excludePatterns,
                includeExtensions: metadata.config.includeExtensions
            };
        }

        if (metadata.stats) {
            formatted.stats = metadata.stats;
        }

        if (metadata.metrics) {
            formatted.metrics = metadata.metrics;
        }

        if (metadata.circularDependencies && metadata.circularDependencies.length > 0) {
            formatted.circularDependencies = metadata.circularDependencies;
        }

        if (metadata.errors && metadata.errors.length > 0) {
            formatted.errors = metadata.errors.slice(0, 10); // Limit errors in output
        }

        return formatted;
    }

    // Utility functions for color manipulation
    darkenColor(color, amount = 0.2) {
        return this.adjustColor(color, -amount);
    }

    lightenColor(color, amount = 0.2) {
        return this.adjustColor(color, amount);
    }

    adjustColor(color, amount) {
        const usePound = color[0] === '#';
        const col = usePound ? color.slice(1) : color;
        
        const num = parseInt(col, 16);
        let r = (num >> 16) + Math.round(255 * amount);
        let g = (num >> 8 & 0x00FF) + Math.round(255 * amount);
        let b = (num & 0x0000FF) + Math.round(255 * amount);
        
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        
        return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
    }

    // Export to other formats
    async exportToCSV(result, outputPath) {
        const lines = ['Type,ID,Label,Path,Dependencies'];
        
        // Add nodes
        result.nodes.forEach(node => {
            const escapedLabel = `"${(node.label || '').replace(/"/g, '""')}"`;
            const escapedPath = `"${(node.path || '').replace(/"/g, '""')}"`;
            lines.push(`node,${node.id},${escapedLabel},${escapedPath},${node.dependencies || 0}`);
        });

        // Add edges
        result.edges.forEach(edge => {
            const escapedLabel = `"${(edge.label || '').replace(/"/g, '""')}"`;
            lines.push(`edge,${edge.from}-${edge.to},${escapedLabel},"",1`);
        });

        await fs.writeFile(outputPath, lines.join('\n'), 'utf8');
    }

    async exportToGraphML(result, outputPath) {
        const graphml = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns
         http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
  <key id="label" for="node" attr.name="label" attr.type="string"/>
  <key id="type" for="node" attr.name="type" attr.type="string"/>
  <key id="path" for="node" attr.name="path" attr.type="string"/>
  <key id="edgeType" for="edge" attr.name="type" attr.type="string"/>
  
  <graph id="dependency-graph" edgedefault="directed">
    ${result.nodes.map(node => `
    <node id="${node.id}">
      <data key="label">${this.escapeXML(node.label)}</data>
      <data key="type">${this.escapeXML(node.type)}</data>
      <data key="path">${this.escapeXML(node.path)}</data>
    </node>`).join('')}
    
    ${result.edges.map(edge => `
    <edge source="${edge.from}" target="${edge.to}">
      <data key="edgeType">${this.escapeXML(edge.type || '')}</data>
    </edge>`).join('')}
  </graph>
</graphml>`;

        await fs.writeFile(outputPath, graphml, 'utf8');
    }

    escapeXML(str) {
        return (str || '').replace(/[<>&'"]/g, (char) => {
            switch (char) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case "'": return '&apos;';
                case '"': return '&quot;';
                default: return char;
            }
        });
    }
}

module.exports = { OutputFormatter };