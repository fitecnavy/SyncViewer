import React, { useState, useEffect, useRef } from 'react';
import { Book, ReadingProgress } from '../../types';
import googleDriveService from '../../services/googleDrive';
import syncService from '../../services/sync';

interface LibraryProps {
  onBookSelect: (book: Book) => void;
}

const Library: React.FC<LibraryProps> = ({ onBookSelect }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<Map<string, ReadingProgress>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      setIsLoading(true);
      const libraryBooks = await googleDriveService.getLibraryBooks();
      setBooks(libraryBooks);

      // 각 책의 읽기 진행 상황 불러오기
      const progressMap = new Map<string, ReadingProgress>();
      for (const book of libraryBooks) {
        const bookProgress = syncService.getReadingProgress(book.id);
        if (bookProgress) {
          progressMap.set(book.id, bookProgress);
        } else {
          // 로컬에 없으면 원격에서 가져오기
          const remoteProgress = await syncService.fetchLatestProgress(book.id);
          if (remoteProgress) {
            progressMap.set(book.id, remoteProgress);
          }
        }
      }
      setProgress(progressMap);
    } catch (error) {
      console.error('Error loading library:', error);
      alert('서재를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // 텍스트 파일 확인
    if (!file.type.includes('text') && !file.name.endsWith('.txt')) {
      alert('텍스트 파일(.txt)만 업로드할 수 있습니다.');
      return;
    }

    try {
      setIsUploading(true);
      const newBook = await googleDriveService.uploadTextFile(file);
      setBooks([newBook, ...books]);
      alert('파일이 서재에 추가되었습니다.');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!confirm('이 책을 서재에서 삭제하시겠습니까?')) return;

    try {
      await googleDriveService.deleteBook(bookId);
      syncService.clearBookProgress(bookId);
      setBooks(books.filter(book => book.id !== bookId));
      alert('책이 삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting book:', error);
      alert('책 삭제에 실패했습니다.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('ko-KR');
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p>서재를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>내 서재</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          style={styles.uploadButton}
        >
          {isUploading ? '업로드 중...' : '+ 책 추가'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      {books.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>서재가 비어있습니다.</p>
          <p style={styles.emptySubtext}>텍스트 파일을 추가하여 시작하세요.</p>
        </div>
      ) : (
        <div style={styles.bookGrid}>
          {books.map(book => {
            const bookProgress = progress.get(book.id);
            const progressPercentage = bookProgress?.percentage || 0;

            return (
              <div key={book.id} style={styles.bookCard}>
                <div style={styles.bookInfo}>
                  <h3 style={styles.bookTitle}>{book.title}</h3>
                  <p style={styles.bookMeta}>
                    {formatFileSize(book.fileSize)} • {formatDate(book.addedAt)}
                  </p>
                  {bookProgress && (
                    <div style={styles.progressContainer}>
                      <div style={styles.progressBar}>
                        <div
                          style={{
                            ...styles.progressFill,
                            width: `${progressPercentage}%`,
                          }}
                        />
                      </div>
                      <span style={styles.progressText}>{progressPercentage.toFixed(0)}%</span>
                    </div>
                  )}
                </div>
                <div style={styles.bookActions}>
                  <button
                    onClick={() => onBookSelect(book)}
                    style={styles.openButton}
                  >
                    열기
                  </button>
                  <button
                    onClick={() => handleDeleteBook(book.id)}
                    style={styles.deleteButton}
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
  },
  uploadButton: {
    backgroundColor: '#4285f4',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    fontSize: '16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '64px 24px',
  },
  emptyText: {
    fontSize: '20px',
    color: '#666',
    marginBottom: '8px',
  },
  emptySubtext: {
    fontSize: '16px',
    color: '#999',
  },
  bookGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '24px',
  },
  bookCard: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '8px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  bookMeta: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '12px',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  progressBar: {
    flex: 1,
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4285f4',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '14px',
    color: '#666',
    minWidth: '40px',
  },
  bookActions: {
    display: 'flex',
    gap: '8px',
  },
  openButton: {
    flex: 1,
    backgroundColor: '#4285f4',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    fontSize: '14px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    fontSize: '14px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default Library;
