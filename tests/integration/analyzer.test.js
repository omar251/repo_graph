/**
 * Integration Tests for Dependency Analyzer
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { DependencyAnalyzer } = require('../../src/analyzer/dependency-analyzer');
const { Logger } = require('../../src/utils/logger');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('DependencyAnalyzer Integration', () => {
    let analyzer;
    let testDir;
    let logger;

    beforeEach(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'depgraph-test-'));
        
        logger = new Logger({ level: 'error', quiet: true });
        analyzer = new DependencyAnalyzer({
            cache: { enabled: false }, // Disable cache for tests
            logging: { level: 'error', quiet: true }
        }, logger);
    });

    afterEach(async () => {
        // Cleanup test directory
        try {
            await fs.rmdir(testDir, { recursive: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    async function createTestFile(relativePath, content) {
        const fullPath = path.join(testDir, relativePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content);
        return fullPath;
    }

    it('should analyze a simple JavaScript project', async () => {
        await createTestFile('index.js', `
            import { helper } from './utils/helper';
            import lodash from 'lodash';
            
            console.log('Hello World');
        `);
        
        await createTestFile('utils/helper.js', `
            import { format } from './formatter';
            
            export function helper() {
                return format('test');
            }
        `);
        
        await createTestFile('utils/formatter.js', `
            export function format(text) {
                return text.toUpperCase();
            }
        `);

        const result = await analyzer.analyze(testDir);

        expect(result.nodes).toHaveLength(3);
        expect(result.edges.length).toBeGreaterThan(0);
        
        // Should find dependency from index.js to utils/helper.js
        const indexNode = result.nodes.find(n => n.label === 'index.js');
        const helperNode = result.nodes.find(n => n.label === 'helper.js');
        
        expect(indexNode).toBeDefined();
        expect(helperNode).toBeDefined();
        
        const edge = result.edges.find(e => e.from === indexNode.id && e.to === helperNode.id);
        expect(edge).toBeDefined();
    });

    it('should handle circular dependencies', async () => {
        await createTestFile('a.js', `import './b';`);
        await createTestFile('b.js', `import './a';`);

        const result = await analyzer.analyze(testDir);

        expect(result.nodes).toHaveLength(2);
        expect(result.edges).toHaveLength(2);
        
        // Should detect circular dependency
        expect(result.metadata.circularDependencies).toBeDefined();
        expect(result.metadata.circularDependencies.length).toBeGreaterThan(0);
    });

    it('should handle missing files gracefully', async () => {
        await createTestFile('index.js', `
            import './missing-file';
            import './existing-file';
        `);
        
        await createTestFile('existing-file.js', `
            export const test = 'value';
        `);

        const result = await analyzer.analyze(testDir);

        // Should still process existing files
        expect(result.nodes.length).toBeGreaterThan(0);
        
        // Should have some missing file node or error
        const hasError = result.metadata.errors && result.metadata.errors.length > 0;
        const hasMissingNode = result.nodes.some(n => n.isMissing);
        
        expect(hasError || hasMissingNode).toBe(true);
    });

    it('should handle Python files', async () => {
        await createTestFile('main.py', `
            import os
            from utils.helper import process_data
            from .local_module import local_function
        `);
        
        await createTestFile('utils/helper.py', `
            def process_data(data):
                return data.upper()
        `);
        
        await createTestFile('local_module.py', `
            def local_function():
                pass
        `);

        const result = await analyzer.analyze(testDir);

        expect(result.nodes.length).toBeGreaterThan(0);
        
        // Should find Python files
        const pythonNodes = result.nodes.filter(n => n.type === 'python');
        expect(pythonNodes.length).toBeGreaterThan(0);
    });

    it('should respect exclude patterns', async () => {
        // Create files in node_modules (should be excluded)
        await createTestFile('node_modules/package/index.js', `export const test = 'value';`);
        await createTestFile('src/index.js', `import './utils';`);
        await createTestFile('src/utils.js', `export const utils = {};`);

        const result = await analyzer.analyze(testDir);

        // Should not include node_modules files
        const nodeModulesFiles = result.nodes.filter(n => n.path.includes('node_modules'));
        expect(nodeModulesFiles).toHaveLength(0);
        
        // Should include src files
        const srcFiles = result.nodes.filter(n => n.path.includes('src/'));
        expect(srcFiles.length).toBeGreaterThan(0);
    });

    it('should generate proper metadata', async () => {
        await createTestFile('index.js', `console.log('test');`);

        const result = await analyzer.analyze(testDir);

        expect(result.metadata).toBeDefined();
        expect(result.metadata.timestamp).toBeDefined();
        expect(result.metadata.version).toBeDefined();
        expect(result.metadata.analysisTime).toBeGreaterThan(0);
        expect(result.metadata.stats).toBeDefined();
        expect(result.metadata.stats.filesScanned).toBeGreaterThan(0);
    });

    it('should handle empty directories', async () => {
        const result = await analyzer.analyze(testDir);

        expect(result.nodes).toHaveLength(0);
        expect(result.edges).toHaveLength(0);
        expect(result.metadata).toBeDefined();
    });

    it('should handle mixed JavaScript and Python projects', async () => {
        await createTestFile('app.js', `
            import './utils';
            console.log('JavaScript app');
        `);
        
        await createTestFile('utils.js', `
            export const utils = {};
        `);
        
        await createTestFile('script.py', `
            import os
            from utils import helper
        `);
        
        await createTestFile('utils.py', `
            def helper():
                pass
        `);

        const result = await analyzer.analyze(testDir);

        const jsNodes = result.nodes.filter(n => n.type === 'javascript');
        const pyNodes = result.nodes.filter(n => n.type === 'python');
        
        expect(jsNodes.length).toBeGreaterThan(0);
        expect(pyNodes.length).toBeGreaterThan(0);
        expect(result.edges.length).toBeGreaterThan(0);
    });
});