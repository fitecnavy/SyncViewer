import { ReadingProgress } from '../types';
import googleDriveService from './googleDrive';

/**
 * 읽기 진행 상황 동기화 서비스
 * 로컬 저장소와 Google Drive 간의 읽기 위치를 동기화합니다.
 */
class SyncService {
  private static instance: SyncService;
  private syncInterval: number | null = null;
  private readonly SYNC_INTERVAL_MS = 30000; // 30초마다 동기화
  private readonly LOCAL_STORAGE_KEY = 'syncviewer_progress';
  private pendingUpdates: Map<string, ReadingProgress> = new Map();
  private isSyncing = false;

  private constructor() {}

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * 자동 동기화 시작
   */
  startAutoSync(): void {
    if (this.syncInterval) return;

    // 초기 동기화
    this.syncAll();

    // 주기적 동기화
    this.syncInterval = window.setInterval(() => {
      this.syncAll();
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * 자동 동기화 중지
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * 읽기 위치 업데이트 (로컬)
   * 변경사항을 로컬에 저장하고 동기화 대기열에 추가
   */
  updateReadingProgress(progress: ReadingProgress): void {
    // 로컬 스토리지에 저장
    const allProgress = this.getAllLocalProgress();
    allProgress[progress.bookId] = progress;
    localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(allProgress));

    // 동기화 대기열에 추가
    this.pendingUpdates.set(progress.bookId, progress);
  }

  /**
   * 특정 책의 읽기 위치 가져오기
   */
  getReadingProgress(bookId: string): ReadingProgress | null {
    const allProgress = this.getAllLocalProgress();
    return allProgress[bookId] || null;
  }

  /**
   * 모든 로컬 읽기 진행 상황 가져오기
   */
  private getAllLocalProgress(): Record<string, ReadingProgress> {
    const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
    if (!stored) return {};

    try {
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error parsing local progress:', error);
      return {};
    }
  }

  /**
   * 특정 책의 진행 상황을 Google Drive와 동기화
   */
  async syncBookProgress(bookId: string): Promise<void> {
    try {
      // 로컬 진행 상황
      const localProgress = this.getReadingProgress(bookId);

      // Google Drive 진행 상황
      const remoteProgress = await googleDriveService.loadReadingProgress(bookId);

      // 동기화 로직: 최신 것을 사용
      if (!localProgress && !remoteProgress) {
        return; // 둘 다 없으면 아무것도 안 함
      }

      if (!localProgress && remoteProgress) {
        // 원격만 있으면 로컬에 저장
        this.updateReadingProgress(remoteProgress);
        return;
      }

      if (localProgress && !remoteProgress) {
        // 로컬만 있으면 원격에 저장
        await googleDriveService.saveReadingProgress(localProgress);
        this.pendingUpdates.delete(bookId);
        return;
      }

      // 둘 다 있으면 최신 것을 사용
      if (localProgress && remoteProgress) {
        if (localProgress.lastUpdated > remoteProgress.lastUpdated) {
          // 로컬이 최신
          await googleDriveService.saveReadingProgress(localProgress);
          this.pendingUpdates.delete(bookId);
        } else if (remoteProgress.lastUpdated > localProgress.lastUpdated) {
          // 원격이 최신
          this.updateReadingProgress(remoteProgress);
        }
        // 같으면 아무것도 안 함
      }
    } catch (error) {
      console.error('Error syncing book progress:', error);
      throw error;
    }
  }

  /**
   * 모든 대기 중인 업데이트를 Google Drive에 동기화
   */
  async syncAll(): Promise<void> {
    if (this.isSyncing) return;
    if (this.pendingUpdates.size === 0) return;

    this.isSyncing = true;

    try {
      const syncPromises: Promise<void>[] = [];

      for (const [bookId, progress] of this.pendingUpdates) {
        syncPromises.push(
          googleDriveService.saveReadingProgress(progress).then(() => {
            this.pendingUpdates.delete(bookId);
          })
        );
      }

      await Promise.all(syncPromises);
    } catch (error) {
      console.error('Error syncing all progress:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 특정 책의 최신 진행 상황을 Google Drive에서 가져오기
   */
  async fetchLatestProgress(bookId: string): Promise<ReadingProgress | null> {
    try {
      const remoteProgress = await googleDriveService.loadReadingProgress(bookId);
      if (remoteProgress) {
        const localProgress = this.getReadingProgress(bookId);

        // 원격이 로컬보다 최신이면 로컬 업데이트
        if (!localProgress || remoteProgress.lastUpdated > localProgress.lastUpdated) {
          this.updateReadingProgress(remoteProgress);
        }

        return remoteProgress;
      }

      return null;
    } catch (error) {
      console.error('Error fetching latest progress:', error);
      return null;
    }
  }

  /**
   * 모든 책의 진행 상황을 동기화
   */
  async syncAllBooks(bookIds: string[]): Promise<void> {
    try {
      const syncPromises = bookIds.map(bookId => this.syncBookProgress(bookId));
      await Promise.all(syncPromises);
    } catch (error) {
      console.error('Error syncing all books:', error);
    }
  }

  /**
   * 로컬 진행 상황 초기화
   */
  clearLocalProgress(): void {
    localStorage.removeItem(this.LOCAL_STORAGE_KEY);
    this.pendingUpdates.clear();
  }

  /**
   * 특정 책의 로컬 진행 상황 삭제
   */
  clearBookProgress(bookId: string): void {
    const allProgress = this.getAllLocalProgress();
    delete allProgress[bookId];
    localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(allProgress));
    this.pendingUpdates.delete(bookId);
  }

  /**
   * 동기화 상태 확인
   */
  getSyncStatus(): { isSyncing: boolean; pendingCount: number } {
    return {
      isSyncing: this.isSyncing,
      pendingCount: this.pendingUpdates.size,
    };
  }

  /**
   * 즉시 동기화 실행
   */
  async syncNow(): Promise<void> {
    await this.syncAll();
  }
}

export default SyncService.getInstance();
