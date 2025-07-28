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
            css: '#e34c26',
            html: '#e34f26',
            json: '#f39c12',
            other: '#9ca3af',
            unknown: '#6c757d'
        };
        
        const normalizedType = type.toLowerCase();
        
        // Better detection for .js files that show as "other"
        if (type === 'other' && node && node.label && node.label.endsWith('.js')) {
            return colors.js;
        }
        
        return colors[normalizedType] || colors[type] || colors.unknown;
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
            // Store original data for dependency analysis
            this.originalData = data;
            
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
                        gravitationalConstant: -3000,
                        centralGravity: 0.1,
                        springLength: 400,
                        springConstant: 0.015,
                        damping: 0.15,
                        avoidOverlap: 1.5
                    },
                    maxVelocity: 30,
                    minVelocity: 0.75,
                    solver: 'barnesHut',
                    timestep: 0.35,
                    stabilization: {
                        iterations: 300,
                        updateInterval: 25,
                        onlyDynamicEdges: false,
                        fit: true
                    },
                    adaptiveTimestep: true,
                    wind: { x: 0, y: 0 },
                    forceAtlas2Based: {
                        gravitationalConstant: -50,
                        centralGravity: 0.01,
                        springConstant: 0.08,
                        springLength: 100,
                        damping: 0.4,
                        avoidOverlap: 0.5
                    }
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
            
            // Update stats and legend
            this.updateStats();
            this.updateLegend(data.nodes); // Use original data, not processed nodes
            
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
            // Keep physics enabled for fluidity but reduce forces
            this.network.setOptions({ 
                physics: { 
                    enabled: true,
                    barnesHut: {
                        gravitationalConstant: -1500,
                        centralGravity: 0.05,
                        springLength: 350,
                        springConstant: 0.01,
                        damping: 0.3,
                        avoidOverlap: 1.2
                    },
                    maxVelocity: 15,
                    minVelocity: 0.5
                } 
            });
            
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
                this.showNodeDetails(nodeId);
                
                // Add attraction effect on click
                this.addAttractionPulse(nodeId);
            } else {
                // Clear details when clicking empty space
                this.clearNodeDetails();
            }
        });

        // Add mouse interaction for fluid effects
        this.network.on('hoverNode', (params) => {
            this.addNodeHoverEffect(params.node);
        });

        this.network.on('blurNode', (params) => {
            this.removeNodeHoverEffect(params.node);
        });
    }

    updateStats() {
        document.getElementById('node-count').textContent = this.nodes ? this.nodes.length : 0;
        document.getElementById('edge-count').textContent = this.edges ? this.edges.length : 0;
    }

    updateLegend(nodes) {
        const legendContainer = document.getElementById('legend');
        if (!legendContainer) {
            console.error('Legend container not found!');
            return;
        }
        
        const typeMap = new Map();
        
        // Count node types
        nodes.forEach(node => {
            const type = node.type || 'unknown';
            const isExternal = node.external === true;
            const isMissing = node.type === 'missing';
            
            let displayType;
            if (isMissing) {
                displayType = 'missing';
            } else if (isExternal) {
                displayType = 'external';
            } else {
                displayType = type;
            }
            
            if (!typeMap.has(displayType)) {
                typeMap.set(displayType, {
                    count: 0,
                    color: this.getNodeColor(type, isExternal, isMissing),
                    label: this.getTypeLabel(displayType)
                });
            }
            typeMap.get(displayType).count++;
        });
        
        // Clear and rebuild legend
        legendContainer.innerHTML = '';
        
        if (typeMap.size === 0) {
            legendContainer.innerHTML = '<div class="legend-item"><span style="color: var(--text-muted);">No data available</span></div>';
            return;
        }
        
        // Sort by count (descending)
        const sortedTypes = Array.from(typeMap.entries()).sort((a, b) => b[1].count - a[1].count);
        
        sortedTypes.forEach(([type, info]) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `
                <div class="legend-color" style="background: ${info.color}; border: 2px solid var(--border-primary);"></div>
                <span>${info.label} (${info.count})</span>
            `;
            legendContainer.appendChild(legendItem);
        });
    }

    getTypeLabel(type) {
        const labels = {
            javascript: 'JavaScript',
            js: 'JavaScript', 
            jsx: 'React JSX',
            ts: 'TypeScript',
            tsx: 'React TSX',
            typescript: 'TypeScript',
            python: 'Python',
            py: 'Python',
            css: 'CSS',
            html: 'HTML',
            external: 'External',
            missing: 'Missing',
            config: 'Config',
            json: 'JSON',
            other: 'JavaScript', // Treat "other" .js files as JavaScript
            unknown: 'Other'
        };
        
        const normalizedType = type.toLowerCase();
        return labels[normalizedType] || labels[type] || (type.charAt(0).toUpperCase() + type.slice(1));
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
                { id: 1, label: 'main.js', path: 'src/main.js', type: 'js', dependencies: 5 },
                { id: 2, label: 'utils.js', path: 'src/utils.js', type: 'js', dependencies: 2 },
                { id: 3, label: 'config.js', path: 'src/config.js', type: 'js', dependencies: 1 },
                { id: 4, label: 'api.js', path: 'src/api.js', type: 'js', dependencies: 3 },
                { id: 5, label: 'component.jsx', path: 'src/component.jsx', type: 'jsx', dependencies: 2 },
                { id: 6, label: 'types.ts', path: 'src/types.ts', type: 'ts', dependencies: 0 },
                { id: 7, label: 'helper.py', path: 'scripts/helper.py', type: 'py', dependencies: 1 },
                { id: 8, label: 'lodash', path: 'node_modules/lodash', type: 'external', external: true },
                { id: 9, label: 'missing-dep', path: 'unknown', type: 'missing' },
                { id: 10, label: 'database.js', path: 'src/database.js', type: 'js', dependencies: 4 },
                { id: 11, label: 'auth.js', path: 'src/auth.js', type: 'js', dependencies: 2 },
                { id: 12, label: 'router.js', path: 'src/router.js', type: 'js', dependencies: 3 },
                { id: 13, label: 'styles.css', path: 'src/styles.css', type: 'css', dependencies: 0 },
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

    addAttractionPulse(nodeId) {
        // Temporarily increase attraction to clicked node
        const connectedNodes = this.network.getConnectedNodes(nodeId);
        
        // Create temporary attractive force
        setTimeout(() => {
            if (this.network) {
                this.network.setOptions({
                    physics: {
                        barnesHut: {
                            gravitationalConstant: -2500, // Stronger attraction
                            centralGravity: 0.2,
                            springLength: 300,
                            springConstant: 0.02,
                            damping: 0.2
                        },
                        maxVelocity: 25
                    }
                });
                
                // Reset after pulse
                setTimeout(() => {
                    if (this.network) {
                        this.network.setOptions({
                            physics: {
                                barnesHut: {
                                    gravitationalConstant: -1500,
                                    centralGravity: 0.05,
                                    springLength: 350,
                                    springConstant: 0.01,
                                    damping: 0.3
                                },
                                maxVelocity: 15
                            }
                        });
                    }
                }, 1000);
            }
        }, 100);
    }

    addNodeHoverEffect(nodeId) {
        // Subtle attraction effect on hover
        const node = this.nodes.get(nodeId);
        if (node) {
            this.nodes.update({
                id: nodeId,
                size: node.size * 1.2,
                borderWidth: 4
            });
        }
    }

    removeNodeHoverEffect(nodeId) {
        // Reset node size on hover out
        const node = this.nodes.get(nodeId);
        if (node) {
            this.nodes.update({
                id: nodeId,
                size: node.size / 1.2,
                borderWidth: 2
            });
        }
    }

    togglePhysics() {
        const currentPhysics = this.network.physics.physicsEnabled;
        this.network.setOptions({
            physics: { enabled: !currentPhysics }
        });
        
        const status = currentPhysics ? 'Physics disabled' : 'Physics enabled';
        this.showStatus(`⚡ ${status}`, 'success');
    }

    adjustFluidity(level) {
        // level: 'low', 'medium', 'high'
        const configs = {
            low: {
                gravitationalConstant: -1000,
                centralGravity: 0.02,
                springLength: 400,
                springConstant: 0.005,
                damping: 0.5,
                maxVelocity: 10
            },
            medium: {
                gravitationalConstant: -1500,
                centralGravity: 0.05,
                springLength: 350,
                springConstant: 0.01,
                damping: 0.3,
                maxVelocity: 15
            },
            high: {
                gravitationalConstant: -2000,
                centralGravity: 0.1,
                springLength: 300,
                springConstant: 0.02,
                damping: 0.2,
                maxVelocity: 25
            }
        };

        const config = configs[level] || configs.medium;
        
        this.network.setOptions({
            physics: {
                barnesHut: config
            }
        });
        
        this.showStatus(`🌊 Fluidity set to ${level}`, 'success');
    }

    showNodeDetails(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        // Get connected nodes
        const connectedNodes = this.network.getConnectedNodes(nodeId);
        const connectedEdges = this.network.getConnectedEdges(nodeId);
        
        // Get dependencies and dependents
        const dependencies = [];
        const dependents = [];
        
        connectedEdges.forEach(edgeId => {
            const edge = this.edges.get(edgeId);
            if (edge.from === nodeId) {
                const targetNode = this.nodes.get(edge.to);
                dependencies.push(targetNode.label);
            } else if (edge.to === nodeId) {
                const sourceNode = this.nodes.get(edge.from);
                dependents.push(sourceNode.label);
            }
        });

        // Update data info section with detailed information
        const detailsHtml = `
            <div class="node-details">
                <h4 style="color: var(--accent-blue); margin-bottom: 8px; font-size: 1rem;">
                    <i class="fas fa-file-code"></i> ${node.label}
                </h4>
                
                ${node.path && node.path !== 'N/A' ? `
                <div class="detail-item">
                    <strong>Path:</strong><br>
                    <code style="font-size: 0.8rem; word-break: break-all;">${node.path}</code>
                </div>
                ` : ''}
                
                <div class="detail-item">
                    <strong>Type:</strong> 
                    <span class="type-badge" style="background: ${node.color.background}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">
                        ${this.getTypeLabel(node.type || 'unknown')}
                    </span>
                </div>
                
                <div class="detail-item">
                    <strong>Connections:</strong> ${connectedNodes.length}
                </div>
                
                ${dependencies.length > 0 ? `
                <div class="detail-item">
                    <strong>Dependencies (${dependencies.length}):</strong><br>
                    <div class="dependency-list">
                        ${dependencies.map(dep => `<span class="dep-item">${dep}</span>`).join('')}
                    </div>
                </div>
                ` : ''}
                
                ${dependents.length > 0 ? `
                <div class="detail-item">
                    <strong>Dependents (${dependents.length}):</strong><br>
                    <div class="dependency-list">
                        ${dependents.map(dep => `<span class="dep-item">${dep}</span>`).join('')}
                    </div>
                </div>
                ` : ''}
                
                ${node.size ? `
                <div class="detail-item">
                    <strong>File Size:</strong> ${this.formatFileSize(node.size)}
                </div>
                ` : ''}
                
                <div class="detail-actions" style="margin-top: 12px; display: flex; gap: 6px;">
                    <button onclick="focusOnNode(${nodeId})" class="detail-btn">
                        <i class="fas fa-crosshairs"></i> Focus
                    </button>
                    <button onclick="highlightConnections(${nodeId})" class="detail-btn">
                        <i class="fas fa-project-diagram"></i> Connections
                    </button>
                </div>
                <div class="detail-actions" style="margin-top: 8px; display: flex; gap: 6px;">
                    <button onclick="findAllDependencies(${nodeId})" class="detail-btn dependency-btn">
                        <i class="fas fa-sitemap"></i> All Dependencies
                    </button>
                    <button onclick="findAllDependents(${nodeId})" class="detail-btn dependent-btn">
                        <i class="fas fa-code-branch"></i> All Dependents
                    </button>
                </div>
            </div>
        `;

        document.getElementById('data-info').innerHTML = detailsHtml;
        this.showStatus(`📋 Viewing details: ${node.label}`, 'success');
    }

    clearNodeDetails() {
        this.updateDataInfo('No data loaded');
        this.showStatus('Click a node to view details', 'success');
    }

    formatFileSize(bytes) {
        if (!bytes) return 'Unknown';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    focusOnNode(nodeId) {
        this.network.focus(nodeId, {
            scale: 1.5,
            animation: {
                duration: 1000,
                easingFunction: 'easeInOutQuad'
            }
        });
        this.showStatus('🎯 Focused on node', 'success');
    }

    highlightConnections(nodeId) {
        const connectedNodes = this.network.getConnectedNodes(nodeId);
        const connectedEdges = this.network.getConnectedEdges(nodeId);
        const selectedNode = this.nodes.get(nodeId);
        
        if (connectedNodes.length === 0) {
            this.showStatus('🔍 This node has no connections', 'error');
            return;
        }

        // Create magical visual effects
        this.createConnectionAnimation(nodeId, connectedNodes, connectedEdges);
        
        // Show detailed connection analysis
        this.showConnectionAnalysis(nodeId, connectedNodes, connectedEdges);
        
        // Focus on the connection cluster
        this.network.fit([nodeId, ...connectedNodes], {
            animation: {
                duration: 1500,
                easingFunction: 'easeInOutQuad'
            }
        });
        
        this.showStatus(`✨ Exploring ${connectedNodes.length} connections for ${selectedNode.label}`, 'success');
    }

    createConnectionAnimation(nodeId, connectedNodes, connectedEdges) {
        // Phase 1: Pulse the main node
        this.pulseNode(nodeId, '#ff6b6b', 1.5);
        
        // Phase 2: Animate connections one by one
        connectedNodes.forEach((connectedId, index) => {
            setTimeout(() => {
                this.pulseNode(connectedId, '#4ecdc4', 1.3);
                this.animateEdge(nodeId, connectedId);
            }, 200 * (index + 1));
        });
        
        // Phase 3: Final highlight
        setTimeout(() => {
            this.network.selectNodes([nodeId, ...connectedNodes]);
            this.network.selectEdges(connectedEdges);
            
            // Auto-clear after showing the magic
            setTimeout(() => {
                this.network.unselectAll();
                this.resetNodeSizes();
            }, 4000);
        }, 200 * connectedNodes.length + 500);
    }

    pulseNode(nodeId, color, scale) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        // Temporarily change node appearance
        this.nodes.update({
            id: nodeId,
            color: {
                background: color,
                border: '#fff',
                highlight: { background: color, border: '#333' }
            },
            size: node.size * scale,
            borderWidth: 4
        });
        
        // Reset after animation
        setTimeout(() => {
            this.nodes.update({
                id: nodeId,
                color: node.color,
                size: node.size,
                borderWidth: node.borderWidth || 2
            });
        }, 1000);
    }

    animateEdge(fromId, toId) {
        const edgeId = this.edges.get().find(edge => 
            (edge.from === fromId && edge.to === toId) || 
            (edge.from === toId && edge.to === fromId)
        )?.id;
        
        if (edgeId) {
            // Temporarily highlight edge
            this.edges.update({
                id: edgeId,
                color: { color: '#ff6b6b', opacity: 1 },
                width: 4
            });
            
            // Reset edge after animation
            setTimeout(() => {
                this.edges.update({
                    id: edgeId,
                    color: { color: '#848484', opacity: 0.8 },
                    width: 2
                });
            }, 1500);
        }
    }

    showConnectionAnalysis(nodeId, connectedNodes, connectedEdges) {
        const selectedNode = this.nodes.get(nodeId);
        const dependencies = [];
        const dependents = [];
        
        // Analyze connection types
        connectedEdges.forEach(edgeId => {
            const edge = this.edges.get(edgeId);
            if (edge.from === nodeId) {
                const targetNode = this.nodes.get(edge.to);
                dependencies.push(targetNode);
            } else if (edge.to === nodeId) {
                const sourceNode = this.nodes.get(edge.from);
                dependents.push(sourceNode);
            }
        });

        // Create enhanced analysis display
        const analysisHtml = `
            <div class="connection-analysis">
                <h4 style="color: var(--accent-blue); margin-bottom: 12px;">
                    🔗 Connection Analysis: ${selectedNode.label}
                </h4>
                
                <div class="analysis-stats">
                    <div class="analysis-stat">
                        <span class="stat-icon">📥</span>
                        <span class="stat-text">Incoming: ${dependents.length}</span>
                    </div>
                    <div class="analysis-stat">
                        <span class="stat-icon">📤</span>
                        <span class="stat-text">Outgoing: ${dependencies.length}</span>
                    </div>
                    <div class="analysis-stat">
                        <span class="stat-icon">🔗</span>
                        <span class="stat-text">Total: ${connectedNodes.length}</span>
                    </div>
                </div>

                ${dependents.length > 0 ? `
                <div class="connection-group">
                    <h5>📥 Files that depend on this:</h5>
                    <div class="connection-list">
                        ${dependents.map(node => `
                            <div class="connection-item" onclick="focusOnNode(${node.id})">
                                <span class="connection-dot" style="background: ${node.color.background};"></span>
                                <span class="connection-name">${node.label}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                ${dependencies.length > 0 ? `
                <div class="connection-group">
                    <h5>📤 Files this depends on:</h5>
                    <div class="connection-list">
                        ${dependencies.map(node => `
                            <div class="connection-item" onclick="focusOnNode(${node.id})">
                                <span class="connection-dot" style="background: ${node.color.background};"></span>
                                <span class="connection-name">${node.label}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="analysis-actions">
                    <button onclick="exploreConnectionChain(${nodeId})" class="analysis-btn">
                        🕸️ Explore Chain
                    </button>
                    <button onclick="findShortestPath(${nodeId})" class="analysis-btn">
                        🎯 Find Paths
                    </button>
                </div>
            </div>
        `;

        document.getElementById('data-info').innerHTML = analysisHtml;
    }

    resetNodeSizes() {
        // Reset all nodes to original sizes
        const updates = this.nodes.get().map(node => ({
            id: node.id,
            size: node.size,
            borderWidth: node.borderWidth || 2
        }));
        this.nodes.update(updates);
    }

    findAllDependencies(nodeId) {
        console.log('Finding dependencies for node:', nodeId);
        console.log('Available edges:', this.edges.get());
        
        const allDependencies = this.getAllDependencies(nodeId);
        const selectedNode = this.nodes.get(nodeId);
        
        console.log('Found dependencies:', allDependencies);
        
        if (allDependencies.length === 0) {
            this.showStatus(`📦 ${selectedNode.label} has no dependencies`, 'success');
            return;
        }

        this.highlightDependencyTree(nodeId, allDependencies, 'dependencies');
        this.showDependencyAnalysis(nodeId, allDependencies, 'dependencies');
        
        this.showStatus(`📦 Found ${allDependencies.length} total dependencies for ${selectedNode.label}`, 'success');
    }

    findAllDependents(nodeId) {
        console.log('Finding dependents for node:', nodeId);
        
        const allDependents = this.getAllDependents(nodeId);
        const selectedNode = this.nodes.get(nodeId);
        
        console.log('Found dependents:', allDependents);
        
        if (allDependents.length === 0) {
            this.showStatus(`🔗 ${selectedNode.label} has no dependents`, 'success');
            return;
        }

        this.highlightDependencyTree(nodeId, allDependents, 'dependents');
        this.showDependencyAnalysis(nodeId, allDependents, 'dependents');
        
        this.showStatus(`🔗 Found ${allDependents.length} total dependents for ${selectedNode.label}`, 'success');
    }

    getAllDependencies(nodeId, visited = new Set(), depth = 0) {
        if (visited.has(nodeId) || depth > 10) return []; // Prevent infinite loops
        
        visited.add(nodeId);
        const dependencies = [];
        const directDeps = [];

        console.log(`Checking dependencies for node ${nodeId} at depth ${depth}`);

        // Find direct dependencies (nodes this node depends on)
        this.edges.get().forEach(edge => {
            console.log(`Checking edge: ${edge.from} -> ${edge.to}`);
            if (edge.from === nodeId && !visited.has(edge.to)) {
                console.log(`Found dependency: ${nodeId} -> ${edge.to}`);
                directDeps.push(edge.to);
                dependencies.push({
                    id: edge.to,
                    depth: depth + 1,
                    path: [...(arguments[3] || []), nodeId, edge.to]
                });
            }
        });

        console.log(`Direct dependencies for ${nodeId}:`, directDeps);

        // Recursively find dependencies of dependencies
        directDeps.forEach(depId => {
            const subDeps = this.getAllDependencies(depId, new Set(visited), depth + 1, 
                [...(arguments[3] || []), nodeId]);
            dependencies.push(...subDeps);
        });

        return dependencies;
    }

    getAllDependents(nodeId, visited = new Set(), depth = 0) {
        if (visited.has(nodeId) || depth > 10) return []; // Prevent infinite loops
        
        visited.add(nodeId);
        const dependents = [];
        const directDeps = [];

        // Find direct dependents (nodes that depend on this node)
        this.edges.get().forEach(edge => {
            if (edge.to === nodeId && !visited.has(edge.from)) {
                directDeps.push(edge.from);
                dependents.push({
                    id: edge.from,
                    depth: depth + 1,
                    path: [...(arguments[3] || []), nodeId, edge.from]
                });
            }
        });

        // Recursively find dependents of dependents
        directDeps.forEach(depId => {
            const subDeps = this.getAllDependents(depId, new Set(visited), depth + 1,
                [...(arguments[3] || []), nodeId]);
            dependents.push(...subDeps);
        });

        return dependents;
    }

    highlightDependencyTree(rootNodeId, dependencies, type) {
        // Reset all nodes first
        this.resetAllNodeStyles();

        // Color scheme for dependency tree
        const colors = {
            root: '#ff6b6b',      // Red for selected node
            depth1: '#4ecdc4',    // Teal for direct dependencies
            depth2: '#45b7d1',    // Blue for 2nd level
            depth3: '#96ceb4',    // Green for 3rd level
            depth4: '#feca57',    // Yellow for 4th level
            deeper: '#a55eea'     // Purple for deeper levels
        };

        // Highlight root node
        this.highlightNode(rootNodeId, colors.root, 1.4);

        // Highlight dependency tree with depth-based colors
        dependencies.forEach(dep => {
            let color;
            switch(dep.depth) {
                case 1: color = colors.depth1; break;
                case 2: color = colors.depth2; break;
                case 3: color = colors.depth3; break;
                case 4: color = colors.depth4; break;
                default: color = colors.deeper; break;
            }
            
            this.highlightNode(dep.id, color, 1.2);
        });

        // Highlight relevant edges
        this.highlightDependencyEdges(rootNodeId, dependencies, type);

        // Focus on the dependency cluster
        const allNodeIds = [rootNodeId, ...dependencies.map(d => d.id)];
        this.network.fit(allNodeIds, {
            animation: { duration: 1500, easingFunction: 'easeInOutQuad' }
        });

        // Auto-clear after 8 seconds
        setTimeout(() => {
            this.resetAllNodeStyles();
            this.network.unselectAll();
        }, 8000);
    }

    highlightNode(nodeId, color, scale) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        this.nodes.update({
            id: nodeId,
            color: {
                background: color,
                border: '#fff',
                highlight: { background: color, border: '#333' }
            },
            size: Math.round(node.size * scale),
            borderWidth: 3,
            font: { ...node.font, color: '#fff', strokeWidth: 2, strokeColor: '#000' }
        });
    }

    highlightDependencyEdges(rootNodeId, dependencies, type) {
        const relevantEdges = [];
        
        dependencies.forEach(dep => {
            this.edges.get().forEach(edge => {
                if (type === 'dependencies') {
                    // For dependencies: highlight edges going FROM root TO dependencies
                    if ((edge.from === rootNodeId && edge.to === dep.id) ||
                        dependencies.some(d => d.id === edge.from && dependencies.some(d2 => d2.id === edge.to))) {
                        relevantEdges.push(edge.id);
                    }
                } else {
                    // For dependents: highlight edges going FROM dependents TO root
                    if ((edge.to === rootNodeId && edge.from === dep.id) ||
                        dependencies.some(d => d.id === edge.to && dependencies.some(d2 => d2.id === edge.from))) {
                        relevantEdges.push(edge.id);
                    }
                }
            });
        });

        // Update edge styles
        relevantEdges.forEach(edgeId => {
            this.edges.update({
                id: edgeId,
                color: { color: '#ff6b6b', opacity: 1 },
                width: 3
            });
        });
    }

    resetAllNodeStyles() {
        // Reset all nodes to original styles
        const updates = this.nodes.get().map(node => {
            // Get original node data to restore proper colors
            const originalNode = this.originalData?.nodes?.find(n => n.id === node.id) || node;
            return {
                id: node.id,
                color: this.getOriginalNodeColor(originalNode),
                size: this.calculateNodeSize(originalNode),
                borderWidth: 2,
                font: { size: 12, color: '#333', strokeWidth: 2, strokeColor: '#fff' }
            };
        });
        this.nodes.update(updates);

        // Reset all edges
        const edgeUpdates = this.edges.get().map(edge => ({
            id: edge.id,
            color: { color: '#848484', opacity: 0.8 },
            width: 2
        }));
        this.edges.update(edgeUpdates);
    }

    getOriginalNodeColor(node) {
        const isExternal = node.external === true;
        const isMissing = node.type === 'missing';
        return {
            background: this.getNodeColor(node.type, isExternal, isMissing),
            border: isMissing ? '#dc3545' : '#fff',
            highlight: {
                background: this.getNodeColor(node.type, isExternal, isMissing),
                border: '#333'
            }
        };
    }

    showDependencyAnalysis(rootNodeId, dependencies, type) {
        const selectedNode = this.nodes.get(rootNodeId);
        const depsByDepth = {};
        
        // Group dependencies by depth
        dependencies.forEach(dep => {
            if (!depsByDepth[dep.depth]) depsByDepth[dep.depth] = [];
            depsByDepth[dep.depth].push(this.nodes.get(dep.id));
        });

        const typeLabel = type === 'dependencies' ? 'Dependencies' : 'Dependents';
        const icon = type === 'dependencies' ? '📦' : '🔗';
        
        const analysisHtml = `
            <div class="dependency-analysis">
                <h4 style="color: var(--accent-blue); margin-bottom: 12px;">
                    ${icon} ${typeLabel} Tree: ${selectedNode.label}
                </h4>
                
                <div class="tree-stats">
                    <div class="tree-stat">
                        <span class="tree-stat-number">${dependencies.length}</span>
                        <span class="tree-stat-label">Total ${typeLabel}</span>
                    </div>
                    <div class="tree-stat">
                        <span class="tree-stat-number">${Object.keys(depsByDepth).length}</span>
                        <span class="tree-stat-label">Depth Levels</span>
                    </div>
                </div>

                <div class="depth-legend">
                    <div class="legend-row">
                        <span class="depth-color" style="background: #ff6b6b;"></span>
                        <span>Selected Node</span>
                    </div>
                    <div class="legend-row">
                        <span class="depth-color" style="background: #4ecdc4;"></span>
                        <span>Level 1 (Direct)</span>
                    </div>
                    <div class="legend-row">
                        <span class="depth-color" style="background: #45b7d1;"></span>
                        <span>Level 2</span>
                    </div>
                    <div class="legend-row">
                        <span class="depth-color" style="background: #96ceb4;"></span>
                        <span>Level 3+</span>
                    </div>
                </div>

                ${Object.keys(depsByDepth).map(depth => `
                    <div class="depth-group">
                        <h5>Level ${depth} (${depsByDepth[depth].length} files):</h5>
                        <div class="depth-list">
                            ${depsByDepth[depth].map(node => `
                                <div class="depth-item" onclick="focusOnNode(${node.id})">
                                    <span class="depth-dot" style="background: ${this.getDepthColor(parseInt(depth))};"></span>
                                    <span class="depth-name">${node.label}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}

                <div class="tree-actions">
                    <button onclick="exportDependencyTree(${rootNodeId}, '${type}')" class="tree-btn">
                        <i class="fas fa-download"></i> Export Tree
                    </button>
                    <button onclick="clearHighlights()" class="tree-btn">
                        <i class="fas fa-times"></i> Clear
                    </button>
                </div>
            </div>
        `;

        document.getElementById('data-info').innerHTML = analysisHtml;
    }

    getDepthColor(depth) {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#a55eea'];
        return colors[Math.min(depth, colors.length - 1)];
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