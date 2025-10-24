import React, { useState, useEffect } from 'react';
import GoogleAuth from './components/Auth/GoogleAuth';
import Library from './components/Library/Library';
import TextViewer from './components/TextViewer/TextViewer';
import { Book, User } from './types';
import googleDriveService from './services/googleDrive';
import fileCacheService from './services/fileCache';
import syncService from './services/sync';

type View = 'library' | 'viewer';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('library');
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const handleAuthChange = async (signedIn: boolean, userData: any) => {
    setIsAuthenticated(signedIn);
    setUser(userData);

    if (signedIn) {
      await initializeServices();
    } else {
      // 로그아웃 시 동기화 중지
      syncService.stopAutoSync();
    }
  };

  const initializeServices = async () => {
    try {
      setIsInitializing(true);

      // 서비스 초기화
      await googleDriveService.initialize();
      await fileCacheService.initialize();

      // 자동 동기화 시작
      syncService.startAutoSync();
    } catch (error) {
      console.error('Error initializing services:', error);
      alert('서비스 초기화에 실패했습니다.');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleBookSelect = (book: Book) => {
    setCurrentBook(book);
    setCurrentView('viewer');
  };

  const handleCloseViewer = () => {
    setCurrentView('library');
    setCurrentBook(null);

    // 뷰어를 닫을 때 동기화 실행
    syncService.syncNow();
  };

  if (!isAuthenticated) {
    return <GoogleAuth onAuthChange={handleAuthChange} />;
  }

  if (isInitializing) {
    return (
      <div style={styles.loadingContainer}>
        <p>서비스를 초기화하는 중...</p>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <GoogleAuth onAuthChange={handleAuthChange} />

      {currentView === 'library' && (
        <Library onBookSelect={handleBookSelect} />
      )}

      {currentView === 'viewer' && currentBook && (
        <TextViewer book={currentBook} onClose={handleCloseViewer} />
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
  },
};

export default App;
