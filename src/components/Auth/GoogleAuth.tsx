import React, { useEffect, useState } from 'react';
import { GOOGLE_CONFIG, validateConfig } from '../../config/google';

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
    // gapi가 로드되었는지 확인
    if (typeof gapi === 'undefined') {
      console.error('gapi is undefined');
      setError('Google API 스크립트가 로드되지 않았습니다.');
      return;
    }

    // 설정 검증
    const configErrors = validateConfig();
    if (configErrors.length > 0) {
      console.error('Configuration errors:', configErrors);
      setError(`설정 오류: ${configErrors.join(', ')}`);
      return;
    }

    console.log('Initializing Google Auth with:', {
      apiKey: GOOGLE_CONFIG.apiKey.substring(0, 10) + '...',
      clientId: GOOGLE_CONFIG.clientId.substring(0, 20) + '...',
      hasEnvVars: {
        apiKey: !!import.meta.env.VITE_GOOGLE_API_KEY,
        clientId: !!import.meta.env.VITE_GOOGLE_CLIENT_ID,
      }
    });

    gapi.load('client:auth2', async () => {
      try {
        console.log('gapi.load callback executed');

        // client만 먼저 초기화 (auth2는 별도로)
        await gapi.client.init({
          apiKey: GOOGLE_CONFIG.apiKey,
          discoveryDocs: GOOGLE_CONFIG.discoveryDocs,
        });

        console.log('gapi.client initialized');

        // auth2 별도 초기화 (iframe 문제 해결)
        console.log('Initializing auth2 with cookie_policy...');

        // getAuthInstance()로 이미 초기화되었는지 확인
        let authInstance = gapi.auth2.getAuthInstance();

        if (!authInstance) {
          authInstance = await gapi.auth2.init({
            client_id: GOOGLE_CONFIG.clientId,
            scope: GOOGLE_CONFIG.scope,
            cookie_policy: 'single_host_origin',
            plugin_name: 'SyncViewer',
          });
          console.log('auth2 initialized with cookie_policy');
        } else {
          console.log('auth2 already initialized');
        }

        console.log('gapi.client.init completed');
        console.log('authInstance:', authInstance);

        // 인증 상태 변경 리스너
        authInstance.isSignedIn.listen((signedIn: boolean) => {
          handleAuthChange(signedIn);
        });

        // 초기 인증 상태 확인
        handleAuthChange(authInstance.isSignedIn.get());
        setIsInitialized(true);
        console.log('Google Auth initialized successfully');
      } catch (err: any) {
        console.error('Error initializing Google Auth (full error):', err);
        console.error('Error details:', {
          message: err?.message,
          details: err?.details,
          error: err?.error,
          result: err?.result,
        });

        let errorMessage = '알 수 없는 오류';
        if (err?.details) {
          errorMessage = err.details;
        } else if (err?.error) {
          errorMessage = `${err.error}: ${err.error_description || ''}`;
        } else if (err?.result?.error) {
          errorMessage = `${err.result.error.message} (${err.result.error.code})`;
        } else if (err?.message) {
          errorMessage = err.message;
        }

        setError(`Google 인증 초기화 실패: ${errorMessage}`);
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

  const handleSignIn = async () => {
    try {
      const authInstance = gapi.auth2.getAuthInstance();
      console.log('Starting sign in...');

      const user = await authInstance.signIn({
        prompt: 'select_account',
      });

      console.log('Sign in successful:', user);
    } catch (err: any) {
      console.error('Sign in error:', err);
      console.error('Error details:', {
        error: err.error,
        details: err.details,
        message: err.message,
      });

      // 사용자에게 더 명확한 에러 표시
      let errorMsg = '로그인에 실패했습니다.';
      if (err.error === 'popup_closed_by_user') {
        errorMsg = '로그인 팝업이 닫혔습니다.';
      } else if (err.error === 'access_denied') {
        errorMsg = '접근이 거부되었습니다. OAuth 동의 화면 설정을 확인하세요.';
      } else if (err.error === 'server_error') {
        errorMsg = 'Google 서버 오류가 발생했습니다. 잠시 후 다시 시도하거나 브라우저를 변경해보세요.';
      }

      alert(errorMsg + '\n\n기술 정보: ' + (err.error || err.message));
    }
  };

  const handleSignOut = () => {
    const authInstance = gapi.auth2.getAuthInstance();
    authInstance.signOut();
  };

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
