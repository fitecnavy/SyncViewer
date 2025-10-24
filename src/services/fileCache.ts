import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { FileCacheChunk, CacheConfig } from '../types';
import googleDriveService from './googleDrive';

interface CacheDB extends DBSchema {
  chunks: {
    key: string; // bookId_startOffset
    value: FileCacheChunk;
    indexes: {
      'by-bookId': string;
      'by-cachedAt': number;
    };
  };
}

/**
 * 파일 캐시를 관리하는 서비스
 * IndexedDB를 사용하여 청크 단위로 파일을 캐시하고,
 * 메모리 효율적인 부분 로딩을 제공합니다.
 */
class FileCacheService {
  private static instance: FileCacheService;
  private db: IDBPDatabase<CacheDB> | null = null;
  private config: CacheConfig = {
    chunkSize: 512 * 1024,        // 512KB
    preloadChunks: 2,              // 앞뒤로 2청크씩 미리 로드
    maxCacheSize: 10 * 1024 * 1024, // 10MB
  };

  private constructor() {}

  static getInstance(): FileCacheService {
    if (!FileCacheService.instance) {
      FileCacheService.instance = new FileCacheService();
    }
    return FileCacheService.instance;
  }

  /**
   * IndexedDB 초기화
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<CacheDB>('SyncViewerCache', 1, {
      upgrade(db) {
        const chunkStore = db.createObjectStore('chunks', { keyPath: 'key' });
        chunkStore.createIndex('by-bookId', 'bookId');
        chunkStore.createIndex('by-cachedAt', 'cachedAt');
      },
    });
  }

  /**
   * 캐시 설정 업데이트
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 주어진 위치에 해당하는 청크와 주변 청크를 로드
   */
  async loadChunksAround(bookId: string, fileSize: number, position: number): Promise<string> {
    if (!this.db) {
      throw new Error('Cache service not initialized');
    }

    const chunkIndex = Math.floor(position / this.config.chunkSize);
    const startChunkIndex = Math.max(0, chunkIndex - this.config.preloadChunks);
    const endChunkIndex = Math.min(
      Math.ceil(fileSize / this.config.chunkSize) - 1,
      chunkIndex + this.config.preloadChunks
    );

    // 필요한 청크들을 로드 (병렬 처리)
    const chunkPromises: Promise<FileCacheChunk>[] = [];
    for (let i = startChunkIndex; i <= endChunkIndex; i++) {
      chunkPromises.push(this.getOrFetchChunk(bookId, fileSize, i));
    }

    const chunks = await Promise.all(chunkPromises);

    // 현재 위치가 포함된 청크 찾기
    const currentChunk = chunks[chunkIndex - startChunkIndex];

    // 오래된 청크 정리
    await this.cleanupOldChunks(bookId);

    return currentChunk.content;
  }

  /**
   * 특정 청크를 캐시에서 가져오거나 Google Drive에서 다운로드
   */
  private async getOrFetchChunk(bookId: string, fileSize: number, chunkIndex: number): Promise<FileCacheChunk> {
    if (!this.db) {
      throw new Error('Cache service not initialized');
    }

    const key = `${bookId}_${chunkIndex}`;

    // 캐시에서 먼저 확인
    const cachedChunk = await this.db.get('chunks', key);
    if (cachedChunk) {
      // 캐시 히트
      return cachedChunk;
    }

    // 캐시 미스 - Google Drive에서 다운로드
    const startOffset = chunkIndex * this.config.chunkSize;
    const endOffset = Math.min(startOffset + this.config.chunkSize - 1, fileSize - 1);

    const content = await googleDriveService.downloadFileChunk(bookId, startOffset, endOffset);

    const chunk: FileCacheChunk = {
      bookId,
      startOffset,
      endOffset,
      content,
      cachedAt: Date.now(),
    };

    // 캐시에 저장
    await this.db.put('chunks', { ...chunk, key });

    return chunk;
  }

  /**
   * 특정 위치의 텍스트 콘텐츠를 가져오기
   * 뷰어가 표시할 텍스트 범위를 반환합니다.
   */
  async getContentAtPosition(
    bookId: string,
    fileSize: number,
    position: number,
    length: number = this.config.chunkSize
  ): Promise<{ content: string; actualPosition: number }> {
    if (!this.db) {
      throw new Error('Cache service not initialized');
    }

    const startChunkIndex = Math.floor(position / this.config.chunkSize);
    const endPosition = Math.min(position + length, fileSize);
    const endChunkIndex = Math.floor(endPosition / this.config.chunkSize);

    // 필요한 청크들을 로드
    const chunks: FileCacheChunk[] = [];
    for (let i = startChunkIndex; i <= endChunkIndex; i++) {
      const chunk = await this.getOrFetchChunk(bookId, fileSize, i);
      chunks.push(chunk);
    }

    // 청크들을 합쳐서 필요한 부분만 추출
    let combinedContent = '';
    for (const chunk of chunks) {
      combinedContent += chunk.content;
    }

    const offsetInFirstChunk = position - (startChunkIndex * this.config.chunkSize);
    const content = combinedContent.substring(offsetInFirstChunk, offsetInFirstChunk + length);

    return {
      content,
      actualPosition: position,
    };
  }

  /**
   * 뷰어용 컨텍스트를 포함한 콘텐츠 가져오기
   * 현재 위치 기준으로 이전/이후 컨텍스트를 포함하여 반환
   */
  async getContentWithContext(
    bookId: string,
    fileSize: number,
    position: number,
    viewSize: number = this.config.chunkSize
  ): Promise<{ content: string; offset: number; totalSize: number }> {
    if (!this.db) {
      throw new Error('Cache service not initialized');
    }

    // 컨텍스트를 고려한 시작 위치 계산
    const contextSize = viewSize; // 앞뒤로 동일한 크기의 컨텍스트
    const startPos = Math.max(0, position - contextSize);
    const endPos = Math.min(fileSize, position + viewSize + contextSize);
    const totalLength = endPos - startPos;

    const result = await this.getContentAtPosition(bookId, fileSize, startPos, totalLength);

    return {
      content: result.content,
      offset: startPos,
      totalSize: fileSize,
    };
  }

  /**
   * 오래된 청크 정리 (LRU 방식)
   */
  private async cleanupOldChunks(currentBookId: string): Promise<void> {
    if (!this.db) return;

    try {
      // 전체 캐시 크기 계산
      const allChunks = await this.db.getAll('chunks');
      const totalSize = allChunks.reduce((sum, chunk) => sum + chunk.content.length, 0);

      if (totalSize > this.config.maxCacheSize) {
        // 오래된 순으로 정렬 (현재 책 제외)
        const chunksToClean = allChunks
          .filter(chunk => chunk.bookId !== currentBookId)
          .sort((a, b) => a.cachedAt - b.cachedAt);

        let freedSize = 0;
        const targetFreeSize = totalSize - this.config.maxCacheSize;

        for (const chunk of chunksToClean) {
          if (freedSize >= targetFreeSize) break;

          const key = `${chunk.bookId}_${Math.floor(chunk.startOffset / this.config.chunkSize)}`;
          await this.db.delete('chunks', key);
          freedSize += chunk.content.length;
        }
      }
    } catch (error) {
      console.error('Error cleaning up old chunks:', error);
    }
  }

  /**
   * 특정 책의 모든 캐시 삭제
   */
  async clearBookCache(bookId: string): Promise<void> {
    if (!this.db) return;

    try {
      const chunks = await this.db.getAllFromIndex('chunks', 'by-bookId', bookId);
      for (const chunk of chunks) {
        const key = `${chunk.bookId}_${Math.floor(chunk.startOffset / this.config.chunkSize)}`;
        await this.db.delete('chunks', key);
      }
    } catch (error) {
      console.error('Error clearing book cache:', error);
    }
  }

  /**
   * 전체 캐시 삭제
   */
  async clearAllCache(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.clear('chunks');
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }

  /**
   * 캐시 통계 정보 가져오기
   */
  async getCacheStats(): Promise<{ totalChunks: number; totalSize: number; books: Set<string> }> {
    if (!this.db) {
      return { totalChunks: 0, totalSize: 0, books: new Set() };
    }

    const allChunks = await this.db.getAll('chunks');
    const books = new Set(allChunks.map(chunk => chunk.bookId));
    const totalSize = allChunks.reduce((sum, chunk) => sum + chunk.content.length, 0);

    return {
      totalChunks: allChunks.length,
      totalSize,
      books,
    };
  }
}

export default FileCacheService.getInstance();
