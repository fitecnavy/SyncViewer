import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, ReadingProgress } from '../../types';
import fileCacheService from '../../services/fileCache';
import syncService from '../../services/sync';

interface TextViewerProps {
  book: Book;
  onClose: () => void;
}

const TextViewer: React.FC<TextViewerProps> = ({ book, onClose }) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [currentLine, setCurrentLine] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentOffsetRef = useRef(0);
  const isInitialLoadRef = useRef(true);
  const lastSaveTimeRef = useRef(Date.now());

  useEffect(() => {
    initializeViewer();

    return () => {
      // 컴포넌트 언마운트 시 진행 상황 저장
      saveProgress();
    };
  }, [book.id]);

  const initializeViewer = async () => {
    try {
      setIsLoading(true);

      // 이전 읽기 위치 불러오기
      const savedProgress = syncService.getReadingProgress(book.id);
      let startPosition = 0;

      if (savedProgress) {
        startPosition = savedProgress.position;
        setCurrentPosition(startPosition);
        setPercentage(savedProgress.percentage);
        if (savedProgress.lineNumber) {
          setCurrentLine(savedProgress.lineNumber);
        }
      } else {
        // 원격에서 확인
        const remoteProgress = await syncService.fetchLatestProgress(book.id);
        if (remoteProgress) {
          startPosition = remoteProgress.position;
          setCurrentPosition(startPosition);
          setPercentage(remoteProgress.percentage);
          if (remoteProgress.lineNumber) {
            setCurrentLine(remoteProgress.lineNumber);
          }
        }
      }

      // 파일 콘텐츠 로드
      await loadContentAtPosition(startPosition);
    } catch (error) {
      console.error('Error initializing viewer:', error);
      alert('파일을 여는데 실패했습니다.');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const loadContentAtPosition = async (position: number) => {
    try {
      const result = await fileCacheService.getContentWithContext(
        book.id,
        book.fileSize,
        position,
        100 * 1024 // 100KB 뷰 크기
      );

      setContent(result.content);
      contentOffsetRef.current = result.offset;

      // 초기 로드 시 저장된 위치로 스크롤
      if (isInitialLoadRef.current && position > 0) {
        setTimeout(() => {
          if (containerRef.current) {
            const relativePosition = position - result.offset;
            const scrollRatio = relativePosition / result.content.length;
            containerRef.current.scrollTop = containerRef.current.scrollHeight * scrollRatio;
          }
          isInitialLoadRef.current = false;
        }, 100);
      }
    } catch (error) {
      console.error('Error loading content:', error);
      throw error;
    }
  };

  const handleScroll = useCallback(() => {
    if (!containerRef.current || isInitialLoadRef.current) return;

    const container = containerRef.current;
    const scrollRatio = container.scrollTop / container.scrollHeight;

    // 현재 위치 계산
    const contentLength = content.length;
    const positionInContent = Math.floor(contentLength * scrollRatio);
    const absolutePosition = contentOffsetRef.current + positionInContent;
    const newPercentage = (absolutePosition / book.fileSize) * 100;

    // 현재 줄 번호 계산
    const textUpToPosition = content.substring(0, positionInContent);
    const lineNumber = calculateLineNumber(textUpToPosition);

    setCurrentPosition(absolutePosition);
    setPercentage(newPercentage);
    setCurrentLine(lineNumber);

    // 주기적으로 진행 상황 저장 (5초마다)
    const now = Date.now();
    if (now - lastSaveTimeRef.current > 5000) {
      saveProgress(absolutePosition, newPercentage, lineNumber);
      lastSaveTimeRef.current = now;
    }

    // 스크롤이 맨 위나 맨 아래에 가까우면 새로운 콘텐츠 로드
    if (scrollRatio < 0.1 && contentOffsetRef.current > 0) {
      // 위로 스크롤 - 이전 콘텐츠 로드
      const newPosition = Math.max(0, absolutePosition - 50 * 1024);
      loadContentAtPosition(newPosition);
    } else if (scrollRatio > 0.9 && contentOffsetRef.current + contentLength < book.fileSize) {
      // 아래로 스크롤 - 다음 콘텐츠 로드
      const newPosition = Math.min(book.fileSize - 1, absolutePosition + 50 * 1024);
      loadContentAtPosition(newPosition);
    }
  }, [content, book.fileSize, book.id]);

  const calculateLineNumber = (textUpToPosition: string): number => {
    // Count newline characters to determine line number
    const newlineCount = (textUpToPosition.match(/\n/g) || []).length;
    return newlineCount + 1;
  };

  const saveProgress = (position?: number, percent?: number, lineNum?: number) => {
    const progress: ReadingProgress = {
      bookId: book.id,
      position: position ?? currentPosition,
      percentage: percent ?? percentage,
      lineNumber: lineNum ?? currentLine,
      lastUpdated: Date.now(),
    };

    syncService.updateReadingProgress(progress);
  };

  const handleGoToPosition = () => {
    const input = prompt('이동할 위치 (%)를 입력하세요 (0-100):');
    if (!input) return;

    const targetPercentage = parseFloat(input);
    if (isNaN(targetPercentage) || targetPercentage < 0 || targetPercentage > 100) {
      alert('올바른 값을 입력하세요 (0-100)');
      return;
    }

    const targetPosition = Math.floor((targetPercentage / 100) * book.fileSize);
    setCurrentPosition(targetPosition);
    setPercentage(targetPercentage);
    loadContentAtPosition(targetPosition);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p>파일을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={onClose} style={styles.backButton}>
            ← 서재로
          </button>
          <h2 style={styles.title}>{book.title}</h2>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.info}>
            {formatFileSize(book.fileSize)} • {percentage.toFixed(1)}%
          </span>
          <button onClick={handleGoToPosition} style={styles.jumpButton}>
            위치 이동
          </button>
        </div>
      </div>

      <div style={styles.progressBar}>
        <div
          style={{
            ...styles.progressFill,
            width: `${percentage}%`,
          }}
        />
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={styles.contentContainer}
      >
        <pre style={styles.content}>{content}</pre>
      </div>

      <div style={styles.footer}>
        <span style={styles.footerText}>
          위치: {currentPosition.toLocaleString()} / {book.fileSize.toLocaleString()} bytes • 줄: {currentLine.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: '16px 24px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  backButton: {
    backgroundColor: '#4285f4',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    fontSize: '14px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  info: {
    fontSize: '14px',
    color: '#666',
  },
  jumpButton: {
    backgroundColor: '#34a853',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    fontSize: '14px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  progressBar: {
    height: '4px',
    backgroundColor: '#e0e0e0',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4285f4',
    transition: 'width 0.3s ease',
  },
  contentContainer: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: 'white',
    padding: '24px',
  },
  content: {
    fontFamily: 'monospace',
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#333',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    margin: 0,
  },
  footer: {
    backgroundColor: 'white',
    padding: '12px 24px',
    borderTop: '1px solid #e0e0e0',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '12px',
    color: '#666',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
  },
};

export default TextViewer;
