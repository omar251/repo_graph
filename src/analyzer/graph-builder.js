/**
 * Graph Builder
 * Builds the dependency graph from parsed file results
 */

const path = require('path');

class GraphBuilder {
    constructor(config = {}, logger) {
        this.config = config;
        this.logger = logger;
        this.nodeMap = new Map();
        this.edgeSet = new Set();
        this.circularDependencies = [];
    }

    async build(parseResults, repositoryPath) {
        this.logger.info('Building dependency graph', {
            files: parseResults.length,
            repositoryPath
        });

        // Reset state
        this.nodeMap.clear();
        this.edgeSet.clear();
        this.circularDependencies = [];

        // 1. Create nodes for all files
        this.createFileNodes(parseResults, repositoryPath);

        // 2. Create edges for dependencies
        this.createDependencyEdges(parseResults, repositoryPath);

        // 3. Detect circular dependencies
        this.detectCircularDependencies();

        // 4. Calculate graph metrics
        const metrics = this.calculateMetrics();

        const result = {
            nodes: Array.from(this.nodeMap.values()),
            edges: Array.from(this.edgeSet).map(edge => JSON.parse(edge)),
            metadata: {
                repositoryPath,
                circularDependencies: this.circularDependencies,
                metrics
            }
        };

        this.logger.info('Graph building completed', {
            nodes: result.nodes.length,
            edges: result.edges.length,
            circularDependencies: this.circularDependencies.length
        });

        return result;
    }

    createFileNodes(parseResults, repositoryPath) {
        let nodeId = 0;

        for (const parseResult of parseResults) {
            const file = parseResult.file;
            const relativePath = path.relative(repositoryPath, file.path);

            const node = {
                id: nodeId++,
                label: path.basename(file.path),
                path: relativePath,
                fullPath: file.path,
                type: this.getFileType(file.extension),
                extension: file.extension,
                size: file.size || 0,
                dependencies: parseResult.dependencies.length,
                parser: parseResult.metadata?.parser || 'unknown'
            };

            // Add additional metadata
            if (parseResult.metadata) {
                node.metadata = parseResult.metadata;
            }

            this.nodeMap.set(file.path, node);
        }

        this.logger.debug('File nodes created', { count: this.nodeMap.size });
    }

    createDependencyEdges(parseResults, repositoryPath) {
        for (const parseResult of parseResults) {
            const sourceFile = parseResult.file;
            const sourceNode = this.nodeMap.get(sourceFile.path);

            if (!sourceNode) continue;

            for (const dependency of parseResult.dependencies) {
                this.createEdgeForDependency(sourceNode, dependency, repositoryPath);
            }
        }

        this.logger.debug('Dependency edges created', { count: this.edgeSet.size });
    }

    createEdgeForDependency(sourceNode, dependency, repositoryPath) {
        let targetNode = null;

        if (dependency.type === 'local') {
            // Try to find the target file
            targetNode = this.findTargetNode(dependency, repositoryPath);
        } else if (dependency.type === 'external' && this.config.includeExternal) {
            // Create external dependency node
            targetNode = this.createExternalNode(dependency);
        }

        if (targetNode) {
            const edge = {
                from: sourceNode.id,
                to: targetNode.id,
                label: dependency.module,
                type: dependency.type,
                importType: dependency.importType || dependency.type,
                line: dependency.line,
                column: dependency.column
            };

            // Add edge styling based on type
            this.styleEdge(edge, dependency);

            const edgeKey = JSON.stringify(edge);
            this.edgeSet.add(edgeKey);
        }
    }

    findTargetNode(dependency, repositoryPath) {
        if (!dependency.resolved) return null;

        // Try exact match first
        let targetNode = this.nodeMap.get(dependency.resolved);
        if (targetNode) return targetNode;

        // Try with different extensions
        const possibleExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.json'];
        
        for (const ext of possibleExtensions) {
            const pathWithExt = dependency.resolved + ext;
            targetNode = this.nodeMap.get(pathWithExt);
            if (targetNode) return targetNode;
        }

        // Try index files
        const indexFiles = ['index.js', 'index.ts', '__init__.py'];
        for (const indexFile of indexFiles) {
            const indexPath = path.join(dependency.resolved, indexFile);
            targetNode = this.nodeMap.get(indexPath);
            if (targetNode) return targetNode;
        }

        // If not found, create a missing file node
        return this.createMissingNode(dependency, repositoryPath);
    }

    createExternalNode(dependency) {
        const nodeId = this.getNextNodeId();
        const packageName = dependency.package || dependency.module.split('/')[0];

        const node = {
            id: nodeId,
            label: packageName,
            path: dependency.module,
            fullPath: dependency.module,
            type: 'external',
            extension: '',
            size: 0,
            dependencies: 0,
            parser: 'external',
            isExternal: true,
            package: packageName
        };

        this.nodeMap.set(`external:${dependency.module}`, node);
        return node;
    }

    createMissingNode(dependency, repositoryPath) {
        const nodeId = this.getNextNodeId();
        const relativePath = path.relative(repositoryPath, dependency.resolved);

        const node = {
            id: nodeId,
            label: path.basename(dependency.resolved),
            path: relativePath,
            fullPath: dependency.resolved,
            type: 'missing',
            extension: path.extname(dependency.resolved),
            size: 0,
            dependencies: 0,
            parser: 'missing',
            isMissing: true
        };

        this.nodeMap.set(dependency.resolved, node);
        return node;
    }

    getNextNodeId() {
        return Math.max(...Array.from(this.nodeMap.values()).map(n => n.id)) + 1;
    }

    styleEdge(edge, dependency) {
        // Color coding based on dependency type
        const colors = {
            'import': '#2196F3',      // Blue
            'require': '#4CAF50',     // Green
            'dynamic-import': '#FF9800', // Orange
            'from-import': '#9C27B0', // Purple
            'relative-import': '#F44336', // Red
            'external': '#607D8B'     // Blue Grey
        };

        edge.color = colors[dependency.type] || '#666666';

        // Line style based on import type
        if (dependency.type === 'dynamic-import') {
            edge.dashes = [5, 5];
        }

        // Width based on frequency (if tracked)
        edge.width = 1;
    }

    detectCircularDependencies() {
        const visited = new Set();
        const recursionStack = new Set();
        const nodes = Array.from(this.nodeMap.values());

        for (const node of nodes) {
            if (!visited.has(node.id)) {
                this.dfsCircularDetection(node.id, visited, recursionStack, []);
            }
        }

        this.logger.debug('Circular dependency detection completed', {
            circularCount: this.circularDependencies.length
        });
    }

    dfsCircularDetection(nodeId, visited, recursionStack, path) {
        visited.add(nodeId);
        recursionStack.add(nodeId);
        path.push(nodeId);

        // Get all outgoing edges from this node
        const edges = Array.from(this.edgeSet)
            .map(edge => JSON.parse(edge))
            .filter(edge => edge.from === nodeId);

        for (const edge of edges) {
            const targetId = edge.to;

            if (!visited.has(targetId)) {
                this.dfsCircularDetection(targetId, visited, recursionStack, [...path]);
            } else if (recursionStack.has(targetId)) {
                // Found a cycle
                const cycleStart = path.indexOf(targetId);
                const cycle = path.slice(cycleStart).concat([targetId]);
                
                this.circularDependencies.push({
                    cycle: cycle,
                    nodes: cycle.map(id => this.getNodeById(id)),
                    length: cycle.length - 1
                });
            }
        }

        recursionStack.delete(nodeId);
        path.pop();
    }

    getNodeById(id) {
        return Array.from(this.nodeMap.values()).find(node => node.id === id);
    }

    calculateMetrics() {
        const nodes = Array.from(this.nodeMap.values());
        const edges = Array.from(this.edgeSet).map(edge => JSON.parse(edge));

        // Basic metrics
        const totalNodes = nodes.length;
        const totalEdges = edges.length;

        // Node type distribution
        const nodeTypes = {};
        nodes.forEach(node => {
            nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
        });

        // Dependency metrics
        const inDegree = new Map();
        const outDegree = new Map();

        nodes.forEach(node => {
            inDegree.set(node.id, 0);
            outDegree.set(node.id, 0);
        });

        edges.forEach(edge => {
            outDegree.set(edge.from, (outDegree.get(edge.from) || 0) + 1);
            inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
        });

        // Find highly connected nodes
        const maxInDegree = Math.max(...inDegree.values());
        const maxOutDegree = Math.max(...outDegree.values());

        const mostDependent = nodes.filter(node => inDegree.get(node.id) === maxInDegree);
        const mostDependedOn = nodes.filter(node => outDegree.get(node.id) === maxOutDegree);

        // Isolated nodes (no dependencies)
        const isolatedNodes = nodes.filter(node => 
            inDegree.get(node.id) === 0 && outDegree.get(node.id) === 0
        );

        return {
            totalNodes,
            totalEdges,
            nodeTypes,
            circularDependencies: this.circularDependencies.length,
            maxInDegree,
            maxOutDegree,
            mostDependent: mostDependent.map(n => ({ id: n.id, label: n.label, path: n.path })),
            mostDependedOn: mostDependedOn.map(n => ({ id: n.id, label: n.label, path: n.path })),
            isolatedNodes: isolatedNodes.length,
            averageInDegree: totalEdges / totalNodes,
            averageOutDegree: totalEdges / totalNodes
        };
    }

    getFileType(extension) {
        const typeMap = {
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.mjs': 'javascript',
            '.cjs': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.pyw': 'python',
            '.json': 'json'
        };

        return typeMap[extension] || 'unknown';
    }
}

module.exports = { GraphBuilder };