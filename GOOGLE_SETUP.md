# Google Cloud Console 설정 가이드

SyncViewer를 GitHub Pages에서 사용하려면 Google Cloud Console에서 OAuth 설정을 완료해야 합니다.

## ⚠️ 중요: OAuth 동의 화면 설정 (필수!)

### 문제: "액세스 차단됨: fitecnavy.github.io은(는) Google 인증 절차를 완료하지 않았습니다"

이 오류는 OAuth 동의 화면이 **테스트 모드**로 설정되어 있기 때문입니다.

### 해결 방법

## 1. Google Cloud Console 접속

https://console.cloud.google.com/ 에 접속합니다.

## 2. 프로젝트 선택

현재 사용 중인 프로젝트를 선택합니다.

## 3. OAuth 동의 화면 설정 (가장 중요!)

1. 왼쪽 메뉴에서 **"API 및 서비스"** → **"OAuth 동의 화면"** 클릭

2. **범위(Scopes) 확인**:
   - **"범위" 또는 "Scopes"** 섹션으로 이동
   - 다음 범위가 추가되어 있는지 확인:
     ```
     https://www.googleapis.com/auth/drive.file
     ```
   - 없다면 **"범위 추가 또는 삭제"** 클릭 후 위 범위 추가
   - 이 범위는 **제한적 범위**이므로 검토 없이 사용 가능

3. **게시 상태 변경**:
   - 현재 상태가 **"테스트"**로 되어 있을 것입니다
   - 페이지 하단에 **"앱 게시"** 또는 **"프로덕션으로 푸시"** 버튼이 있습니다
   - 이 버튼을 클릭하여 앱을 **프로덕션 모드**로 변경합니다

   ⚠️ **참고**:
   - 민감한 범위를 사용하지 않는 경우 Google 검토 없이 바로 게시 가능
   - Google Drive API의 `drive.file` 범위는 민감하지 않은 범위입니다

4. **대안: 테스트 사용자 추가** (프로덕션 모드로 전환하지 않는 경우)
   - OAuth 동의 화면에서 **"테스트 사용자"** 섹션으로 이동
   - **"+ ADD USERS"** 클릭
   - 사용할 Gmail 주소 입력 (`NavyAvatar@gmail.com` 등)
   - 저장

## 4. API 및 서비스 > 사용자 인증 정보

1. 왼쪽 메뉴에서 **"API 및 서비스"** 클릭
2. **"사용자 인증 정보"** 클릭

## 5. OAuth 2.0 클라이언트 ID 설정

### 현재 클라이언트 ID
```
771509966039-vooe355g3k36v9lqu32ulq1nq7d352ne.apps.googleusercontent.com
```

이 클라이언트 ID를 찾아서 클릭하여 수정합니다.

### 승인된 JavaScript 원본에 추가
다음 URL들을 추가해야 합니다:

```
https://fitecnavy.github.io
http://localhost:3000
http://localhost:4173
```

### 승인된 리디렉션 URI에 추가
다음 URL들을 추가해야 합니다:

```
https://fitecnavy.github.io/SyncViewer
https://fitecnavy.github.io/SyncViewer/
http://localhost:3000
http://localhost:4173
```

## 6. Google Drive API 활성화

1. 왼쪽 메뉴에서 **"라이브러리"** 클릭
2. "Google Drive API" 검색
3. **"사용 설정"** 클릭 (이미 활성화되어 있다면 패스)

## 7. 저장 및 테스트

설정을 저장한 후 몇 분 정도 기다린 다음 https://fitecnavy.github.io/SyncViewer/ 에 다시 접속하여 테스트합니다.

## 문제 해결

### ⚠️ "액세스 차단됨: 인증 절차를 완료하지 않았습니다" (403: access_denied)
- **원인**: OAuth 동의 화면이 **테스트 모드**로 되어 있음
- **해결 방법 1 (권장)**:
  - OAuth 동의 화면으로 이동
  - **"앱 게시"** 버튼 클릭하여 프로덕션 모드로 전환
  - Google Drive API의 `drive.file` 범위는 검토 없이 게시 가능
- **해결 방법 2**:
  - OAuth 동의 화면의 "테스트 사용자"에 본인 Gmail 주소 추가

### "idpiframe_initialization_failed" 에러
- **원인**: 승인된 JavaScript 원본에 도메인이 없음
- **해결**: 위의 5번 단계에서 도메인을 추가

### "redirect_uri_mismatch" 에러
- **원인**: 승인된 리디렉션 URI에 도메인이 없음
- **해결**: 위의 5번 단계에서 리디렉션 URI를 추가

### "access_denied" (API 관련)
- **원인**: Google Drive API가 활성화되지 않음
- **해결**: 위의 6번 단계에서 API 활성화

### 브라우저 콘솔에서 에러 확인
F12를 눌러 개발자 도구를 열고 Console 탭에서 정확한 에러 메시지를 확인하세요.

## 빠른 체크리스트

인증이 작동하려면 다음 3가지가 모두 완료되어야 합니다:

- [ ] **OAuth 동의 화면이 프로덕션 모드**이거나 테스트 사용자에 본인 추가됨
- [ ] **승인된 JavaScript 원본**에 `https://fitecnavy.github.io` 추가됨
- [ ] **Google Drive API** 활성화됨
