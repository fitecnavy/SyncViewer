import React, { useEffect, useState } from 'react';

declare const gapi: any;

interface GoogleAuthProps {
  onAuthChange: (isSignedIn: boolean, user: any) => void;
}

const GoogleAuth: React.FC<GoogleAuthProps> = ({ onAuthChange }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initGoogleAuth();
  }, []);

  const initGoogleAuth = () => {
    gapi.load('client:auth2', async () => {
      try {
        await gapi.client.init({
          apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
          clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          scope: 'https://www.googleapis.com/auth/drive.file',
        });

        const authInstance = gapi.auth2.getAuthInstance();

        // 인증 상태 변경 리스너
        authInstance.isSignedIn.listen((signedIn: boolean) => {
          handleAuthChange(signedIn);
        });

        // 초기 인증 상태 확인
        handleAuthChange(authInstance.isSignedIn.get());
        setIsInitialized(true);
      } catch (err) {
        console.error('Error initializing Google Auth:', err);
        setError('Google 인증 초기화에 실패했습니다.');
      }
    });
  };

  const handleAuthChange = (signedIn: boolean) => {
    setIsSignedIn(signedIn);

    if (signedIn) {
      const authInstance = gapi.auth2.getAuthInstance();
      const currentUser = authInstance.currentUser.get();
      const profile = currentUser.getBasicProfile();

      const user = {
        id: profile.getId(),
        email: profile.getEmail(),
        name: profile.getName(),
        picture: profile.getImageUrl(),
      };

      onAuthChange(true, user);
    } else {
      onAuthChange(false, null);
    }
  };

  const handleSignIn = () => {
    const authInstance = gapi.auth2.getAuthInstance();
    authInstance.signIn();
  };

  const handleSignOut = () => {
    const authInstance = gapi.auth2.getAuthInstance();
    authInstance.signOut();
  };

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.error}>{error}</p>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div style={styles.loadingContainer}>
        <p>Google 인증을 초기화하는 중...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div style={styles.signInContainer}>
        <div style={styles.signInCard}>
          <h1 style={styles.title}>SyncViewer</h1>
          <p style={styles.subtitle}>PC와 모바일 간 동기화되는 텍스트 뷰어</p>
          <button onClick={handleSignIn} style={styles.signInButton}>
            Google 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.signedInContainer}>
      <button onClick={handleSignOut} style={styles.signOutButton}>
        로그아웃
      </button>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  signInContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  signInCard: {
    backgroundColor: 'white',
    padding: '48px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    textAlign: 'center',
    maxWidth: '400px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#333',
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '32px',
  },
  signInButton: {
    backgroundColor: '#4285f4',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    fontSize: '16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  signedInContainer: {
    position: 'absolute',
    top: '16px',
    right: '16px',
  },
  signOutButton: {
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    fontSize: '14px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
  },
  errorContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
  },
  error: {
    color: '#f44336',
    fontSize: '16px',
  },
};

export default GoogleAuth;
