import React, { useEffect, useState, useCallback } from 'react';
import { GOOGLE_CONFIG, validateConfig } from '../../config/google';

declare const gapi: any;
declare const google: any;

interface GoogleAuthProps {
  onAuthChange: (isSignedIn: boolean, user: any) => void;
}

// 토큰을 전역으로 관리
let tokenClient: any = null;
let accessToken: string | null = null;

export const getAccessToken = (): string | null => accessToken;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

const GoogleAuth: React.FC<GoogleAuthProps> = ({ onAuthChange }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const handleCredentialResponse = useCallback(async (response: any) => {
    try {
      // ID 토큰에서 사용자 정보 디코딩
      const payload = JSON.parse(atob(response.credential.split('.')[1]));

      const userData = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };

      setUser(userData);

      // Access Token 요청
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (err) {
      console.error('Error processing credential:', err);
      setError('인증 처리 중 오류가 발생했습니다.');
    }
  }, []);

  const initGoogleAuth = useCallback(async () => {
    // gapi와 google 로드 확인
    if (typeof gapi === 'undefined') {
      setError('Google API 스크립트가 로드되지 않았습니다.');
      return;
    }

    if (typeof google === 'undefined') {
      setError('Google Identity Services 스크립트가 로드되지 않았습니다.');
      return;
    }

    // 설정 검증
    const configErrors = validateConfig();
    if (configErrors.length > 0) {
      setError(`설정 오류: ${configErrors.join(', ')}`);
      return;
    }

    try {
      // gapi.client 초기화 (Drive API용)
      await new Promise<void>((resolve) => {
        gapi.load('client', async () => {
          await gapi.client.init({
            apiKey: GOOGLE_CONFIG.apiKey,
            discoveryDocs: GOOGLE_CONFIG.discoveryDocs,
          });
          resolve();
        });
      });

      // Token Client 초기화 (OAuth 2.0)
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CONFIG.clientId,
        scope: GOOGLE_CONFIG.scope,
        callback: (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error('Token error:', tokenResponse);
            setError(`토큰 오류: ${tokenResponse.error}`);
            return;
          }

          accessToken = tokenResponse.access_token;
          setIsSignedIn(true);
          onAuthChange(true, user);
        },
      });

      setIsInitialized(true);

      // 저장된 세션이 있는지 확인 (선택사항)
      const savedUser = localStorage.getItem('syncviewer_user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        // 자동 로그인 시도
        tokenClient.requestAccessToken({ prompt: '' });
      }

    } catch (err: any) {
      console.error('Error initializing Google Auth:', err);
      setError(`Google 인증 초기화 실패: ${err.message || '알 수 없는 오류'}`);
    }
  }, [onAuthChange, user]);

  useEffect(() => {
    // 스크립트 로드 대기
    const checkAndInit = () => {
      if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
        initGoogleAuth();
      } else {
        setTimeout(checkAndInit, 100);
      }
    };
    checkAndInit();
  }, [initGoogleAuth]);

  const handleSignIn = () => {
    if (!tokenClient) {
      setError('인증 클라이언트가 초기화되지 않았습니다.');
      return;
    }

    // Google One Tap 또는 팝업으로 로그인
    google.accounts.id.initialize({
      client_id: GOOGLE_CONFIG.clientId,
      callback: handleCredentialResponse,
      auto_select: false,
    });

    // 버튼 클릭 시 팝업 프롬프트 표시
    google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap이 표시되지 않으면 직접 토큰 요청
        tokenClient.requestAccessToken({ prompt: 'consent' });
      }
    });
  };

  const handleSignOut = () => {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {
        accessToken = null;
        setIsSignedIn(false);
        setUser(null);
        localStorage.removeItem('syncviewer_user');
        onAuthChange(false, null);
      });
    } else {
      setIsSignedIn(false);
      setUser(null);
      localStorage.removeItem('syncviewer_user');
      onAuthChange(false, null);
    }
  };

  // 사용자 정보 저장
  useEffect(() => {
    if (user && isSignedIn) {
      localStorage.setItem('syncviewer_user', JSON.stringify(user));
    }
  }, [user, isSignedIn]);

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorCard}>
          <h2 style={styles.errorTitle}>인증 오류</h2>
          <p style={styles.error}>{error}</p>
          <button onClick={() => window.location.reload()} style={styles.retryButton}>
            새로고침
          </button>
          <div style={styles.helpText}>
            <p><strong>현재 도메인:</strong> {window.location.origin}</p>
            <p><strong>Client ID:</strong> {GOOGLE_CONFIG.clientId.substring(0, 30)}...</p>
            <br />
            <p>문제가 계속되면 다음을 확인하세요:</p>
            <ul style={styles.helpList}>
              <li><strong>Google Cloud Console</strong> (console.cloud.google.com) 접속</li>
              <li><strong>API 및 서비스 &gt; 사용자 인증 정보</strong>로 이동</li>
              <li>OAuth 2.0 클라이언트 ID 클릭하여 설정 확인</li>
              <li><strong>승인된 JavaScript 원본</strong>에 <code>{window.location.origin}</code> 추가</li>
              <li><strong>Google Drive API</strong>가 활성화되어 있는지 확인</li>
              <li>브라우저 콘솔(F12)에서 자세한 오류 메시지 확인</li>
            </ul>
            <p style={{marginTop: '16px', fontSize: '12px', color: '#999'}}>
              자세한 설정 방법은 GOOGLE_SETUP.md 파일을 참고하세요.
            </p>
          </div>
        </div>
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
      {user && (
        <span style={styles.userName}>{user.name}</span>
      )}
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
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userName: {
    fontSize: '14px',
    color: '#666',
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
    backgroundColor: '#f5f5f5',
  },
  errorCard: {
    backgroundColor: 'white',
    padding: '48px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    maxWidth: '600px',
  },
  errorTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#333',
  },
  error: {
    color: '#f44336',
    fontSize: '16px',
    marginBottom: '24px',
    padding: '12px',
    backgroundColor: '#ffebee',
    borderRadius: '4px',
    border: '1px solid #ffcdd2',
  },
  retryButton: {
    backgroundColor: '#4285f4',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    fontSize: '16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    marginBottom: '24px',
  },
  helpText: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'left' as const,
  },
  helpList: {
    marginTop: '8px',
    paddingLeft: '20px',
  },
};

export default GoogleAuth;
