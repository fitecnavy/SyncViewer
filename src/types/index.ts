/**
 * 책 정보를 나타내는 타입
 */
export interface Book {
  id: string;                    // 책의 고유 ID (Google Drive 파일 ID)
  title: string;                 // 책 제목
  fileName: string;              // 원본 파일명
  fileSize: number;              // 파일 크기 (bytes)
  addedAt: number;               // 서재에 추가된 시간 (timestamp)
  lastOpenedAt?: number;         // 마지막으로 열어본 시간 (timestamp)
  driveFileId: string;           // Google Drive 파일 ID
  encoding?: string;             // 텍스트 인코딩 (기본값: utf-8)
}

/**
 * 읽기 진행 상황을 나타내는 타입
 */
export interface ReadingProgress {
  bookId: string;                // 책 ID
  position: number;              // 현재 읽기 위치 (바이트 오프셋)
  percentage: number;            // 읽기 진행률 (0-100)
  lastUpdated: number;           // 마지막 업데이트 시간 (timestamp)
  lineNumber?: number;           // 현재 줄 번호 (옵션)
}

/**
 * 파일 캐시 청크를 나타내는 타입
 */
export interface FileCacheChunk {
  bookId: string;                // 책 ID
  startOffset: number;           // 시작 오프셋 (bytes)
  endOffset: number;             // 종료 오프셋 (bytes)
  content: string;               // 캐시된 텍스트 내용
  cachedAt: number;              // 캐시된 시간 (timestamp)
}

/**
 * 캐시 설정
 */
export interface CacheConfig {
  chunkSize: number;             // 청크 크기 (bytes) - 기본 512KB
  preloadChunks: number;         // 미리 로드할 청크 개수 (앞/뒤) - 기본 2
  maxCacheSize: number;          // 최대 캐시 크기 (bytes) - 기본 10MB
}

/**
 * Google Drive 설정
 */
export interface GoogleDriveConfig {
  clientId: string;
  apiKey: string;
  scopes: string[];
  discoveryDocs: string[];
}

/**
 * 사용자 정보
 */
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * 앱 상태
 */
export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  books: Book[];
  currentBook: Book | null;
  readingProgress: Map<string, ReadingProgress>;
}
