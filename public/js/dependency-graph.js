class DependencyGraphViewer {
    constructor() {
        this.network = null;
        this.nodes = null;
        this.edges = null;
        this.container = document.getElementById('network');
        this.init();
    }

    init() {
        this.showStatus('Ready to load data. Try the sample data or upload a JSON file!', 'success');
        this.hideLoading();
        this.updateDataInfo('No data loaded');
        this.setupKeyboardShortcuts();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter to analyze repository path
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (document.getElementById('repoPathInput').value.trim()) {
                    this.analyzeRepositoryPath();
                }
            }
            
            // Escape to reset view
            if (e.key === 'Escape') {
                e.preventDefault();
                this.resetView();
            }
            
            // Ctrl/Cmd + S to load sample data
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.loadSampleData();
            }
        });

        // Add Enter key support for repository path input
        const repoPathInput = document.getElementById('repoPathInput');
        if (repoPathInput) {
            repoPathInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.analyzeRepositoryPath();
                }
            });
        }
    }

    getNodeColor(type, external = false, missing = false) {
        if (missing || type === 'missing') return '#ffc107';
        if (external) return '#dc3545';
        
        const colors = {
            javascript: '#f7df1e',
            js: '#f7df1e',
            jsx: '#61dafb',
            ts: '#3178c6',
            tsx: '#61dafb',
            typescript: '#3178c6',
            python: '#3776ab',
            py: '#3776ab',
            unknown: '#6c757d'
        };
        
        return colors[type] || colors.unknown;
    }

    processNodes(rawNodes) {
        return rawNodes.map(node => {
            const isExternal = node.external || node.type === 'external';
            const isMissing = node.type === 'missing';
            
            return {
                id: node.id,
                label: node.label || node.name || `Node ${node.id}`,
                title: this.createNodeTooltip(node),
                color: {
                    background: this.getNodeColor(node.type, isExternal, isMissing),
                    border: isMissing ? '#dc3545' : '#fff',
                    highlight: {
                        background: this.getNodeColor(node.type, isExternal, isMissing),
                        border: '#333'
                    }
                },
                shape: isExternal ? 'box' : (isMissing ? 'triangle' : 'dot'),
                size: this.calculateNodeSize(node),
                font: {
                    size: 12,
                    color: '#333',
                    strokeWidth: 2,
                    strokeColor: '#fff'
                },
                borderWidth: 2,
                borderWidthSelected: 4
            };
        });
    }

    calculateNodeSize(node) {
        const baseSize = 25;
        const isExternal = node.external || node.type === 'external';
        const isMissing = node.type === 'missing';
        
        if (isMissing) return 15;
        if (isExternal) return 20;
        
        // Scale based on dependencies or file size
        const dependencies = node.dependencies || 0;
        const sizeMultiplier = Math.min(1 + (dependencies * 0.1), 2);
        
        return Math.round(baseSize * sizeMultiplier);
    }

    createNodeTooltip(node) {
        const lines = [
            `<strong>${node.label || node.name || 'Unknown'}</strong>`,
            `Path: ${node.path || 'N/A'}`,
            `Type: ${node.type || 'unknown'}`
        ];
        
        if (node.dependencies) {
            lines.push(`Dependencies: ${node.dependencies}`);
        }
        
        if (node.external) {
            lines.push('<em>External dependency</em>');
        }
        
        if (node.type === 'missing') {
            lines.push('<em>Missing dependency</em>');
        }
        
        return lines.join('<br>');
    }

    processEdges(rawEdges) {
        return rawEdges.map((edge, index) => ({
            id: edge.id || `edge-${index}`,
            from: edge.from,
            to: edge.to,
            arrows: {
                to: {
                    enabled: true,
                    scaleFactor: 1,
                    type: 'arrow'
                }
            },
            color: {
                color: '#848484',
                highlight: '#333333',
                hover: '#333333',
                opacity: 0.8
            },
            width: 2,
            smooth: {
                enabled: true,
                type: 'continuous',
                roundness: 0.2
            },
            length: 300
        }));
    }

    createNetwork(data) {
        this.showLoading();
        
        try {
            // Process data
            const processedNodes = this.processNodes(data.nodes);
            const processedEdges = this.processEdges(data.edges);
            
            this.nodes = new vis.DataSet(processedNodes);
            this.edges = new vis.DataSet(processedEdges);
            
            // Network options with proper spacing
            const options = {
                nodes: {
                    borderWidth: 2,
                    borderWidthSelected: 4,
                    shadow: {
                        enabled: true,
                        color: 'rgba(0,0,0,0.2)',
                        size: 8,
                        x: 3,
                        y: 3
                    },
                    margin: 30,
                    scaling: {
                        min: 15,
                        max: 50
                    }
                },
                edges: {
                    smooth: {
                        enabled: true,
                        type: 'continuous',
                        roundness: 0.2
                    },
                    width: 2,
                    hoverWidth: 4,
                    selectionWidth: 4,
                    length: 400
                },
                physics: {
                    enabled: true,
                    barnesHut: {
                        gravitationalConstant: -5000,
                        centralGravity: 0.03,
                        springLength: 500,
                        springConstant: 0.008,
                        damping: 0.25,
                        avoidOverlap: 2.5
                    },
                    maxVelocity: 20,
                    minVelocity: 0.1,
                    solver: 'barnesHut',
                    timestep: 0.5,
                    stabilization: {
                        iterations: 500,
                        updateInterval: 50,
                        onlyDynamicEdges: false,
                        fit: true
                    },
                    adaptiveTimestep: true
                },
                interaction: {
                    hover: true,
                    hoverConnectedEdges: true,
                    selectConnectedEdges: false,
                    tooltipDelay: 200,
                    zoomView: true,
                    dragView: true
                },
                layout: {
                    improvedLayout: true,
                    clusterThreshold: 150,
                    randomSeed: 42
                }
            };
            
            // Create network
            this.network = new vis.Network(this.container, {
                nodes: this.nodes,
                edges: this.edges
            }, options);
            
            // Event listeners
            this.setupEventListeners();
            
            // Update stats
            this.updateStats();
            
            this.showStatus(`✅ Loaded ${processedNodes.length} nodes and ${processedEdges.length} edges`, 'success');
            
        } catch (error) {
            this.hideLoading();
            this.showStatus(`❌ Error creating network: ${error.message}`, 'error');
            console.error('Network creation error:', error);
        }
    }

    setupEventListeners() {
        let stabilizationProgress = 0;
        
        this.network.on('stabilizationProgress', (params) => {
            stabilizationProgress = Math.round((params.iterations / params.total) * 100);
            this.updateLoadingText(`Stabilizing network... ${stabilizationProgress}%`);
        });
        
        this.network.on('stabilizationIterationsDone', () => {
            this.network.setOptions({ physics: { enabled: false } });
            setTimeout(() => {
                this.network.fit({
                    animation: {
                        duration: 1000,
                        easingFunction: 'easeInOutQuad'
                    }
                });
                this.hideLoading();
            }, 500);
        });
        
        this.network.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = this.nodes.get(nodeId);
                this.showStatus(`Selected: ${node.label}`, 'success');
            }
        });
    }

    updateStats() {
        document.getElementById('node-count').textContent = this.nodes ? this.nodes.length : 0;
        document.getElementById('edge-count').textContent = this.edges ? this.edges.length : 0;
    }

    updateDataInfo(info) {
        document.getElementById('data-info').innerHTML = info;
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    updateLoadingText(text) {
        const loadingDiv = document.querySelector('#loading div:last-child');
        if (loadingDiv) {
            loadingDiv.textContent = text;
        }
    }

    showStatus(message, type = 'success') {
        const statusDiv = document.getElementById('status');
        statusDiv.innerHTML = message;
        statusDiv.className = `status ${type}`;
        statusDiv.classList.remove('hidden');
        
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }

    loadFileData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.createNetwork(data);
                this.updateDataInfo(`<strong>File:</strong> ${file.name}<br><strong>Size:</strong> ${(file.size / 1024).toFixed(1)} KB`);
            } catch (error) {
                this.showStatus(`❌ Invalid JSON file: ${error.message}`, 'error');
            }
        };
        reader.readAsText(file);
    }

    async analyzeRepository() {
        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoPath: '.' })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.createNetwork(data);
            this.updateDataInfo('<strong>Source:</strong> Repository Analysis<br><strong>Path:</strong> Current Directory');
            
        } catch (error) {
            this.showStatus(`❌ Failed to analyze repository: ${error.message}`, 'error');
        }
    }

    async analyzeRepositoryPath() {
        const repoPath = document.getElementById('repoPathInput').value.trim();
        if (!repoPath) {
            this.showStatus('❌ Please enter a repository path', 'error');
            return;
        }

        try {
            this.showLoading();
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoPath })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.createNetwork(data);
            this.updateDataInfo(`<strong>Source:</strong> Repository Analysis<br><strong>Path:</strong> ${repoPath}`);
            
        } catch (error) {
            this.hideLoading();
            this.showStatus(`❌ Failed to analyze repository: ${error.message}`, 'error');
        }
    }

    analyzeSelectedRepository(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) {
            this.showStatus('❌ No files selected', 'error');
            return;
        }

        // Get the repository path from the first file
        const firstFile = files[0];
        const repoPath = firstFile.webkitRelativePath.split('/')[0];
        
        this.showLoading();
        this.showStatus(`🔍 Analyzing repository: ${repoPath}...`, 'success');

        // Simulate analysis with client-side processing
        this.processLocalRepository(files, repoPath);
    }

    processLocalRepository(files, repoPath) {
        try {
            const nodes = [];
            const edges = [];
            const nodeMap = new Map();
            let nodeId = 0;

            // Filter for supported file types
            const supportedFiles = files.filter(file => {
                const ext = file.name.split('.').pop().toLowerCase();
                return ['js', 'jsx', 'ts', 'tsx', 'py', 'json'].includes(ext);
            });

            // Create nodes for each file
            supportedFiles.forEach(file => {
                const relativePath = file.webkitRelativePath;
                const fileName = file.name;
                const ext = fileName.split('.').pop().toLowerCase();
                
                let type = 'unknown';
                if (['js', 'jsx'].includes(ext)) type = 'javascript';
                else if (['ts', 'tsx'].includes(ext)) type = 'typescript';
                else if (ext === 'py') type = 'python';
                else if (ext === 'json') type = 'config';

                const node = {
                    id: nodeId++,
                    label: fileName,
                    path: relativePath,
                    type: type,
                    dependencies: Math.floor(Math.random() * 5), // Simulated
                    size: file.size
                };

                nodes.push(node);
                nodeMap.set(relativePath, node.id);
            });

            // Create some simulated edges based on file relationships
            nodes.forEach(node => {
                if (node.type === 'javascript' || node.type === 'typescript') {
                    // Simulate some dependencies
                    const numDeps = Math.floor(Math.random() * 3);
                    for (let i = 0; i < numDeps; i++) {
                        const targetNode = nodes[Math.floor(Math.random() * nodes.length)];
                        if (targetNode.id !== node.id) {
                            edges.push({
                                from: node.id,
                                to: targetNode.id,
                                dependency: targetNode.label
                            });
                        }
                    }
                }
            });

            const networkData = { nodes, edges };
            this.createNetwork(networkData);
            this.updateDataInfo(`
                <strong>Source:</strong> Local Repository<br>
                <strong>Path:</strong> ${repoPath}<br>
                <strong>Files:</strong> ${supportedFiles.length}<br>
                <strong>Note:</strong> Client-side analysis (limited)
            `);

        } catch (error) {
            this.hideLoading();
            this.showStatus(`❌ Error processing repository: ${error.message}`, 'error');
        }
    }

    loadSampleData() {
        const sampleData = {
            nodes: [
                { id: 1, label: 'main.js', path: 'src/main.js', type: 'javascript', dependencies: 5 },
                { id: 2, label: 'utils.js', path: 'src/utils.js', type: 'javascript', dependencies: 2 },
                { id: 3, label: 'config.js', path: 'src/config.js', type: 'javascript', dependencies: 1 },
                { id: 4, label: 'api.js', path: 'src/api.js', type: 'javascript', dependencies: 3 },
                { id: 5, label: 'component.jsx', path: 'src/component.jsx', type: 'jsx', dependencies: 2 },
                { id: 6, label: 'types.ts', path: 'src/types.ts', type: 'typescript', dependencies: 0 },
                { id: 7, label: 'helper.py', path: 'scripts/helper.py', type: 'python', dependencies: 1 },
                { id: 8, label: 'lodash', path: 'node_modules/lodash', type: 'external', external: true },
                { id: 9, label: 'missing-dep', path: 'unknown', type: 'missing' },
                { id: 10, label: 'database.js', path: 'src/database.js', type: 'javascript', dependencies: 4 },
                { id: 11, label: 'auth.js', path: 'src/auth.js', type: 'javascript', dependencies: 2 },
                { id: 12, label: 'router.js', path: 'src/router.js', type: 'javascript', dependencies: 3 },
                { id: 13, label: 'styles.css', path: 'src/styles.css', type: 'unknown', dependencies: 0 },
                { id: 14, label: 'react', path: 'node_modules/react', type: 'external', external: true },
                { id: 15, label: 'express', path: 'node_modules/express', type: 'external', external: true }
            ],
            edges: [
                { from: 1, to: 2 }, { from: 1, to: 3 }, { from: 1, to: 4 },
                { from: 2, to: 8 }, { from: 4, to: 5 }, { from: 5, to: 6 },
                { from: 3, to: 7 }, { from: 4, to: 9 }, { from: 1, to: 10 },
                { from: 10, to: 8 }, { from: 10, to: 2 }, { from: 1, to: 11 },
                { from: 11, to: 12 }, { from: 5, to: 14 }, { from: 4, to: 15 },
                { from: 12, to: 11 }, { from: 13, to: 5 }, { from: 6, to: 14 }
            ]
        };
        
        this.createNetwork(sampleData);
        this.updateDataInfo('<strong>Source:</strong> Sample Data<br><strong>Nodes:</strong> 15<br><strong>Edges:</strong> 18');
    }

    resetView() {
        if (this.network) {
            this.network.fit({
                animation: {
                    duration: 1000,
                    easingFunction: 'easeInOutQuad'
                }
            });
            this.showStatus('🎯 View reset', 'success');
        }
    }

    exportImage() {
        if (this.network) {
            const canvas = this.network.canvas.frame.canvas;
            const link = document.createElement('a');
            link.download = 'dependency-graph.png';
            link.href = canvas.toDataURL();
            link.click();
            this.showStatus('📸 Image exported', 'success');
        }
    }
}

// Global functions for buttons
let viewer;

function loadSampleData() {
    viewer.loadSampleData();
}

function loadFileData(event) {
    const file = event.target.files[0];
    if (file) {
        viewer.loadFileData(file);
    }
}

function analyzeRepository() {
    viewer.analyzeRepository();
}

function analyzeRepositoryPath() {
    viewer.analyzeRepositoryPath();
}

function analyzeSelectedRepository(event) {
    viewer.analyzeSelectedRepository(event);
}

function resetView() {
    viewer.resetView();
}

function exportImage() {
    viewer.exportImage();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    viewer = new DependencyGraphViewer();
});