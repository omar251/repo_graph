/**
 * JavaScript Parser Tests
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');
const { JavaScriptParser } = require('../../../src/parsers/javascript-parser');

describe('JavaScriptParser', () => {
    let parser;

    beforeEach(() => {
        parser = new JavaScriptParser();
    });

    describe('ES6 Import Parsing', () => {
        it('should parse named imports', () => {
            const content = `import { foo, bar } from './utils';`;
            const dependencies = parser.extractDependencies(content);
            
            expect(dependencies).toHaveLength(1);
            expect(dependencies[0]).toMatchObject({
                module: './utils',
                type: 'import',
                line: 1
            });
        });

        it('should parse default imports', () => {
            const content = `import React from 'react';`;
            const dependencies = parser.extractDependencies(content);
            
            expect(dependencies).toHaveLength(1);
            expect(dependencies[0]).toMatchObject({
                module: 'react',
                type: 'import',
                line: 1
            });
        });

        it('should parse namespace imports', () => {
            const content = `import * as utils from './utils';`;
            const dependencies = parser.extractDependencies(content);
            
            expect(dependencies).toHaveLength(1);
            expect(dependencies[0].module).toBe('./utils');
        });

        it('should parse side-effect imports', () => {
            const content = `import './polyfills';`;
            const dependencies = parser.extractDependencies(content);
            
            expect(dependencies).toHaveLength(1);
            expect(dependencies[0].module).toBe('./polyfills');
        });
    });

    describe('CommonJS Require Parsing', () => {
        it('should parse require statements', () => {
            const content = `const fs = require('fs');`;
            const dependencies = parser.extractDependencies(content);
            
            expect(dependencies).toHaveLength(1);
            expect(dependencies[0]).toMatchObject({
                module: 'fs',
                type: 'require',
                line: 1
            });
        });

        it('should parse destructured requires', () => {
            const content = `const { readFile } = require('fs').promises;`;
            const dependencies = parser.extractDependencies(content);
            
            expect(dependencies).toHaveLength(1);
            expect(dependencies[0].module).toBe('fs');
        });
    });

    describe('Dynamic Import Parsing', () => {
        it('should parse dynamic imports', () => {
            const content = `const module = await import('./dynamic-module');`;
            const dependencies = parser.extractDependencies(content);
            
            expect(dependencies).toHaveLength(1);
            expect(dependencies[0]).toMatchObject({
                module: './dynamic-module',
                type: 'dynamic-import',
                line: 1
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle multiline imports', () => {
            const content = `import {
                foo,
                bar,
                baz
            } from './utils';`;
            
            const dependencies = parser.extractDependencies(content);
            expect(dependencies).toHaveLength(1);
            expect(dependencies[0].module).toBe('./utils');
        });

        it('should handle comments in imports', () => {
            const content = `
                // This is a comment
                import React from 'react'; // React import
                /* Block comment */
                import './styles.css';
            `;
            
            const dependencies = parser.extractDependencies(content);
            expect(dependencies).toHaveLength(2);
        });

        it('should skip template literals', () => {
            const content = `import(\`./modules/\${moduleName}\`);`;
            const dependencies = parser.extractDependencies(content);
            
            // Should not parse template literals as static imports
            expect(dependencies).toHaveLength(0);
        });

        it('should handle nested quotes', () => {
            const content = `import module from "path/with'quote";`;
            const dependencies = parser.extractDependencies(content);
            
            expect(dependencies).toHaveLength(1);
            expect(dependencies[0].module).toBe("path/with'quote");
        });
    });

    describe('Path Resolution', () => {
        it('should identify external dependencies', () => {
            expect(parser.isExternalDependency('react')).toBe(true);
            expect(parser.isExternalDependency('@babel/core')).toBe(true);
            expect(parser.isExternalDependency('./local')).toBe(false);
            expect(parser.isExternalDependency('../parent')).toBe(false);
            expect(parser.isExternalDependency('/absolute')).toBe(false);
        });

        it('should resolve relative paths', () => {
            const currentFile = '/project/src/components/Button.js';
            const result = parser.resolveModulePath('./utils', currentFile);
            
            expect(result.type).toBe('local');
            expect(result.path).toBe('./utils');
        });

        it('should handle scoped packages', () => {
            const currentFile = '/project/src/index.js';
            const result = parser.resolveModulePath('@babel/core', currentFile);
            
            expect(result.type).toBe('external');
            expect(result.scope).toBe('@babel');
            expect(result.package).toBe('@babel/core');
        });
    });

    describe('Validation', () => {
        it('should reject invalid dependencies', () => {
            expect(parser.isValidDependency({ module: '' })).toBe(false);
            expect(parser.isValidDependency({ module: 'data:text/plain;base64,SGVsbG8=' })).toBe(false);
            expect(parser.isValidDependency({ module: 'https://example.com/script.js' })).toBe(false);
            expect(parser.isValidDependency({ module: 'valid-module' })).toBe(true);
        });
    });
});