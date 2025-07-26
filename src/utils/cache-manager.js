/**
 * Cache Manager
 * Provides file-based caching for analysis results
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CacheManager {
    constructor(options = {}, logger) {
        this.cacheDir = options.cacheDir || path.join(process.cwd(), '.depgraph/cache');
        this.maxAge = options.maxAge || 24 * 60 * 60 * 1000; // 24 hours
        this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB
        this.enabled = options.enabled !== false;
        this.logger = logger;
        this.stats = {
            hits: 0,
            misses: 0,
            writes: 0,
            errors: 0
        };
    }

    async initialize() {
        if (!this.enabled) {
            this.logger?.debug('Cache disabled');
            return;
        }
        
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
            await this.cleanupExpired();
            await this.enforceMaxSize();
            this.logger?.debug('Cache initialized', { cacheDir: this.cacheDir });
        } catch (error) {
            this.logger?.warn('Failed to initialize cache', { error: error.message });
            this.enabled = false;
        }
    }

    generateKey(data) {
        const hash = crypto.createHash('sha256');
        
        if (typeof data === 'string') {
            hash.update(data);
        } else {
            hash.update(JSON.stringify(data));
        }
        
        return hash.digest('hex');
    }

    async get(key) {
        if (!this.enabled) return null;
        
        try {
            const cacheFile = path.join(this.cacheDir, `${key}.json`);
            const stats = await fs.stat(cacheFile);
            
            // Check if cache is expired
            if (Date.now() - stats.mtime.getTime() > this.maxAge) {
                await fs.unlink(cacheFile);
                this.stats.misses++;
                this.logger?.debug('Cache expired', { key });
                return null;
            }
            
            const content = await fs.readFile(cacheFile, 'utf8');
            const cached = JSON.parse(content);
            
            this.stats.hits++;
            this.logger?.debug('Cache hit', { key });
            return cached.data;
            
        } catch (error) {
            this.stats.misses++;
            this.logger?.debug('Cache miss', { key, error: error.message });
            return null;
        }
    }

    async set(key, data) {
        if (!this.enabled) return;
        
        try {
            const cacheFile = path.join(this.cacheDir, `${key}.json`);
            const cached = {
                timestamp: Date.now(),
                key: key,
                data: data
            };
            
            await fs.writeFile(cacheFile, JSON.stringify(cached));
            this.stats.writes++;
            this.logger?.debug('Cache set', { key });
            
        } catch (error) {
            this.stats.errors++;
            this.logger?.warn('Failed to write cache', { key, error: error.message });
        }
    }

    async has(key) {
        if (!this.enabled) return false;
        
        try {
            const cacheFile = path.join(this.cacheDir, `${key}.json`);
            const stats = await fs.stat(cacheFile);
            
            // Check if cache is expired
            return Date.now() - stats.mtime.getTime() <= this.maxAge;
        } catch {
            return false;
        }
    }

    async delete(key) {
        if (!this.enabled) return;
        
        try {
            const cacheFile = path.join(this.cacheDir, `${key}.json`);
            await fs.unlink(cacheFile);
            this.logger?.debug('Cache entry deleted', { key });
        } catch (error) {
            this.logger?.debug('Failed to delete cache entry', { key, error: error.message });
        }
    }

    async cleanupExpired() {
        if (!this.enabled) return;
        
        try {
            const files = await fs.readdir(this.cacheDir);
            const now = Date.now();
            let cleanedCount = 0;
            
            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                
                const filePath = path.join(this.cacheDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    
                    if (now - stats.mtime.getTime() > this.maxAge) {
                        await fs.unlink(filePath);
                        cleanedCount++;
                    }
                } catch (error) {
                    // File might have been deleted by another process
                    continue;
                }
            }
            
            if (cleanedCount > 0) {
                this.logger?.debug('Cache cleanup completed', { cleanedCount });
            }
        } catch (error) {
            this.logger?.warn('Cache cleanup failed', { error: error.message });
        }
    }

    async enforceMaxSize() {
        if (!this.enabled) return;
        
        try {
            const files = await fs.readdir(this.cacheDir);
            let totalSize = 0;
            const fileStats = [];
            
            // Calculate total size and collect file info
            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                
                const filePath = path.join(this.cacheDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    totalSize += stats.size;
                    fileStats.push({
                        path: filePath,
                        size: stats.size,
                        mtime: stats.mtime.getTime()
                    });
                } catch {
                    continue;
                }
            }
            
            // If over limit, remove oldest files
            if (totalSize > this.maxSize) {
                fileStats.sort((a, b) => a.mtime - b.mtime); // Oldest first
                let removedSize = 0;
                let removedCount = 0;
                
                for (const fileInfo of fileStats) {
                    if (totalSize - removedSize <= this.maxSize) break;
                    
                    try {
                        await fs.unlink(fileInfo.path);
                        removedSize += fileInfo.size;
                        removedCount++;
                    } catch {
                        continue;
                    }
                }
                
                this.logger?.debug('Cache size enforcement completed', {
                    removedCount,
                    removedSize,
                    remainingSize: totalSize - removedSize
                });
            }
        } catch (error) {
            this.logger?.warn('Cache size enforcement failed', { error: error.message });
        }
    }

    async clear() {
        if (!this.enabled) return;
        
        try {
            const files = await fs.readdir(this.cacheDir);
            let clearedCount = 0;
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    await fs.unlink(path.join(this.cacheDir, file));
                    clearedCount++;
                }
            }
            
            this.logger?.info('Cache cleared', { clearedCount });
            this.stats = { hits: 0, misses: 0, writes: 0, errors: 0 };
        } catch (error) {
            this.logger?.warn('Failed to clear cache', { error: error.message });
        }
    }

    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;
            
        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            enabled: this.enabled
        };
    }

    // Generate cache key for file analysis
    async generateFileKey(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const keyData = {
                path: filePath,
                size: stats.size,
                mtime: stats.mtime.getTime()
            };
            return this.generateKey(keyData);
        } catch {
            return this.generateKey(filePath);
        }
    }

    // Generate cache key for repository analysis
    async generateRepoKey(repoPath, options = {}) {
        try {
            const keyData = {
                repoPath,
                options: {
                    includeExternal: options.includeExternal,
                    excludePatterns: options.excludePatterns,
                    includeExtensions: options.includeExtensions
                }
            };
            return this.generateKey(keyData);
        } catch {
            return this.generateKey(`${repoPath}_${JSON.stringify(options)}`);
        }
    }
}

module.exports = { CacheManager };