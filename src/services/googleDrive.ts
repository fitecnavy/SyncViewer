import { Book, ReadingProgress } from '../types';

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
   * Google Drive API 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

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
      // 기존 폴더 찾기
      const response = await gapi.client.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id;
      }

      // 폴더가 없으면 생성
      const createResponse = await gapi.client.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });

      return createResponse.result.id;
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
          Authorization: `Bearer ${gapi.client.getToken().access_token}`,
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
      const response = await gapi.client.drive.files.list({
        q: `'${this.libraryFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, size, createdTime, modifiedTime)',
        orderBy: 'modifiedTime desc',
      });

      const books: Book[] = response.result.files.map((file: any) => ({
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
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${gapi.client.getToken().access_token}`,
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
      const fileName = `${progress.bookId}_progress.json`;

      // 기존 진행 상황 파일 찾기
      const searchResponse = await gapi.client.drive.files.list({
        q: `name='${fileName}' and '${this.progressFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
      });

      const content = JSON.stringify(progress);
      const blob = new Blob([content], { type: 'application/json' });

      if (searchResponse.result.files && searchResponse.result.files.length > 0) {
        // 기존 파일 업데이트
        const fileId = searchResponse.result.files[0].id;
        const formData = new FormData();
        formData.append('file', blob);

        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${gapi.client.getToken().access_token}`,
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
            Authorization: `Bearer ${gapi.client.getToken().access_token}`,
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
      const fileName = `${bookId}_progress.json`;

      const searchResponse = await gapi.client.drive.files.list({
        q: `name='${fileName}' and '${this.progressFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
      });

      if (!searchResponse.result.files || searchResponse.result.files.length === 0) {
        return null;
      }

      const fileId = searchResponse.result.files[0].id;
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${gapi.client.getToken().access_token}`,
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
      await gapi.client.drive.files.delete({
        fileId: bookId,
      });

      // 연관된 진행 상황 파일도 삭제
      const fileName = `${bookId}_progress.json`;
      const searchResponse = await gapi.client.drive.files.list({
        q: `name='${fileName}' and '${this.progressFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
      });

      if (searchResponse.result.files && searchResponse.result.files.length > 0) {
        await gapi.client.drive.files.delete({
          fileId: searchResponse.result.files[0].id,
        });
      }
    } catch (error) {
      console.error('Error deleting book:', error);
      throw error;
    }
  }
}

export default GoogleDriveService.getInstance();
