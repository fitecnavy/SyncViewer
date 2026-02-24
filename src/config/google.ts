/**
 * Google API 설정
 *
 * 프로덕션 환경에서는 이 파일의 값을 직접 설정하거나,
 * 빌드 시 환경 변수를 주입해야 합니다.
 */

export const GOOGLE_CONFIG = {
  // 환경 변수가 있으면 사용하고, 없으면 하드코딩된 값 사용
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY || 'AIzaSyAQxQu6PLy3iVk825OOpNt_JOf7BRUFqxI',
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '771509966039-vooe355g3k36v9lqu32ulq1nq7d352ne.apps.googleusercontent.com',
  discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  scope: 'https://www.googleapis.com/auth/drive.file',
};

// 설정이 올바른지 검증
export const validateConfig = () => {
  const errors = [];

  if (!GOOGLE_CONFIG.apiKey || GOOGLE_CONFIG.apiKey === 'YOUR_API_KEY') {
    errors.push('Google API Key가 설정되지 않았습니다.');
  }

  if (!GOOGLE_CONFIG.clientId || GOOGLE_CONFIG.clientId === 'YOUR_CLIENT_ID') {
    errors.push('Google Client ID가 설정되지 않았습니다.');
  }

  return errors;
};
