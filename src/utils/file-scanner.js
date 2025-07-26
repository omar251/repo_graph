/**
 * File Scanner
 * Efficiently scans directories for supported files with filtering and exclusion
 */

const fs = require('fs').promises;
const path = require('path');

class FileScanner {
    constructor(config = {}, logger) {
        this.config = {
            maxFileSize: config.maxFileSize || 1024 * 1024, // 1MB
            excludePatterns: config.excludePatterns || [
                'node_modules/**',
                '.git/**',
                'dist/**',
                'build/**',
                '**/*.min.js',
                'coverage/**',
                '.nyc_output/**'
            ],
            includeExtensions: config.includeExtensions || ['.js', '.jsx', '.ts', '.tsx', '.py'],
            followSymlinks: config.followSymlinks || false,
            maxDepth: config.maxDepth || 50,
            ...config
        };
        
        this.logger = logger;
        this.stats = {
            filesScanned: 0,
            filesSkipped: 0,
            directoriesScanned: 0,
            totalSize: 0,
            scanTime: 0
        };
    }

    async scan(rootPath) {
        const startTime = Date.now();
        
        try {
            this.logger.info('Starting file scan', { rootPath });
            
            // Reset stats
            this.resetStats();
            
            // Perform scan
            const files = await this.scanDirectory(rootPath, '', 0);
            const filteredFiles = await this.filterFiles(files);
            
            this.stats.scanTime = Date.now() - startTime;
            
            this.logger.info('File scan completed', {
                ...this.stats,
                totalFiles: filteredFiles.length,
                rootPath
            });
            
            return filteredFiles;
            
        } catch (error) {
            this.logger.error('File scan failed', { 
                rootPath, 
                error: error.message 
            });
            throw error;
        }
    }

    async scanDirectory(dirPath, relativePath = '', depth = 0) {
        const files = [];
        
        // Check depth limit
        if (depth > this.config.maxDepth) {
            this.logger.warn('Maximum depth reached, skipping', { 
                path: dirPath, 
                depth 
            });
            return files;
        }
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            this.stats.directoriesScanned++;
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const relPath = path.join(relativePath, entry.name);
                
                // Check exclusion patterns early
                if (this.isExcluded(relPath)) {
                    this.stats.filesSkipped++;
                    continue;
                }
                
                if (entry.isDirectory()) {
                    const subFiles = await this.scanDirectory(fullPath, relPath, depth + 1);
                    files.push(...subFiles);
                } else if (entry.isFile()) {
                    if (this.shouldIncludeFile(entry.name)) {
                        files.push({
                            path: fullPath,
                            relativePath: relPath,
                            name: entry.name,
                            extension: path.extname(entry.name)
                        });
                        this.stats.filesScanned++;
                    } else {
                        this.stats.filesSkipped++;
                    }
                } else if (entry.isSymbolicLink() && this.config.followSymlinks) {
                    try {
                        const stats = await fs.stat(fullPath);
                        if (stats.isFile() && this.shouldIncludeFile(entry.name)) {
                            files.push({
                                path: fullPath,
                                relativePath: relPath,
                                name: entry.name,
                                extension: path.extname(entry.name),
                                isSymlink: true
                            });
                            this.stats.filesScanned++;
                        }
                    } catch (symlinkError) {
                        this.logger.debug('Broken symlink encountered', {
                            path: fullPath,
                            error: symlinkError.message
                        });
                        this.stats.filesSkipped++;
                    }
                }
            }
            
        } catch (error) {
            this.logger.warn('Failed to scan directory', {
                path: dirPath,
                error: error.message
            });
        }
        
        return files;
    }

    async filterFiles(files) {
        const filtered = [];
        
        // Process files in chunks to avoid overwhelming the system
        const chunkSize = 100;
        const chunks = this.chunkArray(files, chunkSize);
        
        for (const chunk of chunks) {
            const promises = chunk.map(file => this.validateFile(file));
            const results = await Promise.allSettled(promises);
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    filtered.push(result.value);
                } else if (result.status === 'rejected') {
                    this.logger.debug('File validation failed', {
                        file: chunk[index].path,
                        error: result.reason.message
                    });
                    this.stats.filesSkipped++;
                }
            });
        }
        
        return filtered;
    }

    async validateFile(file) {
        try {
            const stats = await fs.stat(file.path);
            
            // Check file size
            if (stats.size > this.config.maxFileSize) {
                this.logger.debug('File too large, skipping', {
                    file: file.path,
                    size: stats.size,
                    maxSize: this.config.maxFileSize
                });
                return null;
            }
            
            // Check if file is readable
            await fs.access(file.path, fs.constants.R_OK);
            
            this.stats.totalSize += stats.size;
            
            return {
                ...file,
                size: stats.size,
                mtime: stats.mtime,
                ctime: stats.ctime
            };
            
        } catch (error) {
            this.logger.debug('File validation failed', {
                file: file.path,
                error: error.message
            });
            return null;
        }
    }

    isExcluded(filePath) {
        // Normalize path separators for cross-platform compatibility
        const normalizedPath = filePath.replace(/\\/g, '/');
        
        return this.config.excludePatterns.some(pattern => {
            const regex = this.globToRegex(pattern);
            return regex.test(normalizedPath);
        });
    }

    globToRegex(pattern) {
        // Convert glob pattern to regex
        let regexPattern = pattern
            .replace(/\./g, '\\.')           // Escape dots
            .replace(/\*\*/g, '§DOUBLESTAR§') // Temporarily replace **
            .replace(/\*/g, '[^/]*')         // * matches anything except /
            .replace(/§DOUBLESTAR§/g, '.*')  // ** matches anything including /
            .replace(/\?/g, '[^/]');         // ? matches single character except /
        
        // Anchor the pattern
        if (!regexPattern.startsWith('^')) {
            regexPattern = '^' + regexPattern;
        }
        if (!regexPattern.endsWith('$')) {
            regexPattern = regexPattern + '$';
        }
        
        return new RegExp(regexPattern);
    }

    shouldIncludeFile(filename) {
        const ext = path.extname(filename).toLowerCase();
        return this.config.includeExtensions.includes(ext);
    }

    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    resetStats() {
        this.stats = {
            filesScanned: 0,
            filesSkipped: 0,
            directoriesScanned: 0,
            totalSize: 0,
            scanTime: 0
        };
    }

    getStats() {
        return { ...this.stats };
    }

    // Get file count by extension
    getFileTypeStats(files) {
        const stats = {};
        
        files.forEach(file => {
            const ext = file.extension || 'no-extension';
            stats[ext] = (stats[ext] || 0) + 1;
        });
        
        return stats;
    }

    // Get size distribution
    getSizeStats(files) {
        const sizes = files.map(f => f.size || 0);
        
        if (sizes.length === 0) {
            return { min: 0, max: 0, average: 0, total: 0 };
        }
        
        return {
            min: Math.min(...sizes),
            max: Math.max(...sizes),
            average: Math.round(sizes.reduce((sum, size) => sum + size, 0) / sizes.length),
            total: sizes.reduce((sum, size) => sum + size, 0)
        };
    }
}

module.exports = { FileScanner };