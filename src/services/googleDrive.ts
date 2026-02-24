import { Book, ReadingProgress } from '../types';
import { getAccessToken } from '../components/Auth/GoogleAuth';

declare const gapi: any;

/**
 * Google Drive API를 사용하여 파일 및 메타데이터를 관리하는 서비스
 */
class GoogleDriveService {
  private static instance: GoogleDriveService;
  private isInitialized = false;
  private readonly LIBRARY_FOLDER_NAME = 'SyncViewer_Library';
  private readonly PROGRESS_FOLDER_NAME = 'SyncViewer_Progress';
  private libraryFolderId: string | null = null;
  private progressFolderId: string | null = null;

  private constructor() {}

  static getInstance(): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService();
    }
    return GoogleDriveService.instance;
  }

  /**
   * 현재 액세스 토큰 가져오기
   */
  private getToken(): string {
    const token = getAccessToken();
    if (!token) {
      throw new Error('Access token not available. Please sign in first.');
    }
    return token;
  }

  /**
   * Google Drive API 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // gapi.client가 이미 초기화되어 있는지 확인
    if (typeof gapi !== 'undefined' && gapi.client) {
      this.isInitialized = true;
    } else {
      await new Promise<void>((resolve) => {
        gapi.load('client', async () => {
          await gapi.client.init({
            apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });
          this.isInitialized = true;
          resolve();
        });
      });
    }

    // 폴더 생성 또는 찾기
    await this.ensureFoldersExist();
  }

  /**
   * 필요한 폴더가 존재하는지 확인하고 없으면 생성
   */
  private async ensureFoldersExist(): Promise<void> {
    this.libraryFolderId = await this.findOrCreateFolder(this.LIBRARY_FOLDER_NAME);
    this.progressFolderId = await this.findOrCreateFolder(this.PROGRESS_FOLDER_NAME);
  }

  /**
   * 폴더 찾기 또는 생성
   */
  private async findOrCreateFolder(folderName: string): Promise<string> {
    try {
      const token = this.getToken();

      // 기존 폴더 찾기
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)&spaces=drive`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const searchResult = await searchResponse.json();

      if (searchResult.files && searchResult.files.length > 0) {
        return searchResult.files[0].id;
      }

      // 폴더가 없으면 생성
      const createResponse = await fetch(
        'https://www.googleapis.com/drive/v3/files?fields=id',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
          }),
        }
      );

      const createResult = await createResponse.json();
      return createResult.id;
    } catch (error) {
      console.error('Error finding/creating folder:', error);
      throw error;
    }
  }

  /**
   * 텍스트 파일을 Google Drive에 업로드
   */
  async uploadTextFile(file: File): Promise<Book> {
    if (!this.libraryFolderId) {
      throw new Error('Library folder not initialized');
    }

    try {
      const token = this.getToken();

      const metadata = {
        name: file.name,
        mimeType: 'text/plain',
        parents: [this.libraryFolderId],
      };

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', file);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      const book: Book = {
        id: result.id,
        title: file.name.replace(/\.\w+$/, ''), // 확장자 제거
        fileName: result.name,
        fileSize: parseInt(result.size),
        addedAt: Date.now(),
        driveFileId: result.id,
        encoding: 'utf-8',
      };

      return book;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * 서재의 모든 책 목록 가져오기
   */
  async getLibraryBooks(): Promise<Book[]> {
    if (!this.libraryFolderId) {
      throw new Error('Library folder not initialized');
    }

    try {
      const token = this.getToken();

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${this.libraryFolderId}' in parents and trashed=false&fields=files(id,name,size,createdTime,modifiedTime)&orderBy=modifiedTime desc`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      const books: Book[] = (result.files || []).map((file: any) => ({
        id: file.id,
        title: file.name.replace(/\.\w+$/, ''),
        fileName: file.name,
        fileSize: parseInt(file.size || '0'),
        addedAt: new Date(file.createdTime).getTime(),
        lastOpenedAt: new Date(file.modifiedTime).getTime(),
        driveFileId: file.id,
        encoding: 'utf-8',
      }));

      return books;
    } catch (error) {
      console.error('Error getting library books:', error);
      throw error;
    }
  }

  /**
   * 파일의 특정 범위(청크)를 다운로드
   */
  async downloadFileChunk(fileId: string, startOffset: number, endOffset: number): Promise<string> {
    try {
      const token = this.getToken();

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Range: `bytes=${startOffset}-${endOffset}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download file chunk: ${response.statusText}`);
      }

      const text = await response.text();
      return text;
    } catch (error) {
      console.error('Error downloading file chunk:', error);
      throw error;
    }
  }

  /**
   * 읽기 진행 상황을 Google Drive에 저장
   */
  async saveReadingProgress(progress: ReadingProgress): Promise<void> {
    if (!this.progressFolderId) {
      throw new Error('Progress folder not initialized');
    }

    try {
      const token = this.getToken();
      const fileName = `${progress.bookId}_progress.json`;

      // 기존 진행 상황 파일 찾기
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${this.progressFolderId}' in parents and trashed=false&fields=files(id)`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const searchResult = await searchResponse.json();

      const content = JSON.stringify(progress);
      const blob = new Blob([content], { type: 'application/json' });

      if (searchResult.files && searchResult.files.length > 0) {
        // 기존 파일 업데이트
        const fileId = searchResult.files[0].id;

        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: blob,
        });
      } else {
        // 새 파일 생성
        const metadata = {
          name: fileName,
          mimeType: 'application/json',
          parents: [this.progressFolderId],
        };

        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', blob);

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
      }
    } catch (error) {
      console.error('Error saving reading progress:', error);
      throw error;
    }
  }

  /**
   * 읽기 진행 상황을 Google Drive에서 불러오기
   */
  async loadReadingProgress(bookId: string): Promise<ReadingProgress | null> {
    if (!this.progressFolderId) {
      throw new Error('Progress folder not initialized');
    }

    try {
      const token = this.getToken();
      const fileName = `${bookId}_progress.json`;

      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${this.progressFolderId}' in parents and trashed=false&fields=files(id)`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const searchResult = await searchResponse.json();

      if (!searchResult.files || searchResult.files.length === 0) {
        return null;
      }

      const fileId = searchResult.files[0].id;
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const text = await response.text();
      return JSON.parse(text) as ReadingProgress;
    } catch (error) {
      console.error('Error loading reading progress:', error);
      return null;
    }
  }

  /**
   * 책을 서재에서 삭제
   */
  async deleteBook(bookId: string): Promise<void> {
    try {
      const token = this.getToken();

      await fetch(`https://www.googleapis.com/drive/v3/files/${bookId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // 연관된 진행 상황 파일도 삭제
      const fileName = `${bookId}_progress.json`;
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${this.progressFolderId}' in parents and trashed=false&fields=files(id)`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const searchResult = await searchResponse.json();

      if (searchResult.files && searchResult.files.length > 0) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${searchResult.files[0].id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Error deleting book:', error);
      throw error;
    }
  }
}

export default GoogleDriveService.getInstance();
