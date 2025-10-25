import React, { useEffect, useState } from 'react';

declare const gapi: any;
declare const google: any;

interface GoogleAuthProps {
  onAuthChange: (isSignedIn: boolean, user: any) => void;
}

const GoogleAuth: React.FC<GoogleAuthProps> = ({ onAuthChange }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);

  useEffect(() => {
    initGoogleAuth();
  }, []);

  const initGoogleAuth = () => {
    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });

        // Google Identity Services의 TokenClient 초기화
        const client = google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: (response: any) => {
            if (response.error) {
              console.error('Error getting token:', response);
              setError('로그인에 실패했습니다.');
              return;
            }

            // 토큰 설정
            gapi.client.setToken({
              access_token: response.access_token,
            });

            // 사용자 정보 가져오기
            fetchUserInfo(response.access_token);
          },
        });

        setTokenClient(client);

        // 기존 토큰이 있는지 확인
        const token = gapi.client.getToken();
        if (token && token.access_token) {
          setIsSignedIn(true);
          fetchUserInfo(token.access_token);
        }

        setIsInitialized(true);
      } catch (err) {
        console.error('Error initializing Google Auth:', err);
        setError('Google 인증 초기화에 실패했습니다.');
      }
    });
  };

  const fetchUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      const userInfo = await response.json();
      const user = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      };

      setIsSignedIn(true);
      onAuthChange(true, user);
    } catch (err) {
      console.error('Error fetching user info:', err);
      setError('사용자 정보를 가져오는데 실패했습니다.');
    }
  };

  const handleSignIn = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }
  };

  const handleSignOut = () => {
    const token = gapi.client.getToken();
    if (token) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        gapi.client.setToken(null);
        setIsSignedIn(false);
        onAuthChange(false, null);
      });
    }
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
