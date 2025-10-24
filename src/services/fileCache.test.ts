import { describe, it, expect, beforeEach, vi } from 'vitest';
import fileCacheService from './fileCache';

// Mock IndexedDB
vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve({
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    getAll: vi.fn(() => Promise.resolve([])),
    getAllFromIndex: vi.fn(() => Promise.resolve([])),
  })),
}));

// Mock googleDriveService
vi.mock('./googleDrive', () => ({
  default: {
    initialize: vi.fn(),
    downloadFileChunk: vi.fn(() => Promise.resolve('test content')),
  },
}));

describe('FileCacheService', () => {
  beforeEach(async () => {
    await fileCacheService.initialize();
  });

  it('should initialize successfully', async () => {
    await expect(fileCacheService.initialize()).resolves.not.toThrow();
  });

  it('should update cache configuration', () => {
    const newConfig = {
      chunkSize: 1024 * 1024, // 1MB
      preloadChunks: 3,
    };

    expect(() => fileCacheService.updateConfig(newConfig)).not.toThrow();
  });

  it('should clear all cache without errors', async () => {
    await expect(fileCacheService.clearAllCache()).resolves.not.toThrow();
  });

  it('should get cache stats', async () => {
    const stats = await fileCacheService.getCacheStats();

    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('totalChunks');
    expect(stats).toHaveProperty('totalSize');
    expect(stats).toHaveProperty('books');
  });
});
