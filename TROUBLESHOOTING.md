# server_error 문제 해결 가이드

`server_error`가 계속 발생한다면 다음 체크리스트를 **순서대로** 확인하세요.

## 📋 체크리스트

### ✅ 1단계: Google Drive API 활성화 확인

1. https://console.cloud.google.com/apis/library/drive.googleapis.com 접속
2. 올바른 프로젝트가 선택되어 있는지 확인 (상단 프로젝트 선택 드롭다운)
3. **"API 사용 설정됨"** 또는 **"관리"** 버튼이 보이면 OK
4. **"사용 설정"** 버튼이 보이면 클릭하여 활성화

### ✅ 2단계: OAuth 동의 화면 - 범위(Scopes) 확인

1. https://console.cloud.google.com/apis/credentials/consent 접속
2. **"앱 수정"** 또는 **"EDIT APP"** 버튼 클릭
3. **2단계: 범위**로 이동 (또는 "Scopes" 탭 클릭)
4. **"범위 추가 또는 삭제"** 버튼 클릭
5. 검색창에 `drive.file` 입력
6. 다음 범위를 찾아서 **체크** (이미 체크되어 있는지 확인):
   ```
   https://www.googleapis.com/auth/drive.file
   ```
   설명: "View and manage Google Drive files and folders that you have opened or created with this app"
7. **"업데이트"** 버튼 클릭
8. **"저장 후 계속"** 클릭
9. 남은 단계들도 **"저장 후 계속"** 클릭하여 완료

⚠️ **중요**: 범위가 추가되어 있어도 저장을 다시 한 번 해주세요!

### ✅ 3단계: OAuth 동의 화면 - 앱 게시

1. https://console.cloud.google.com/apis/credentials/consent 접속
2. **게시 상태** 확인:
   - **"프로덕션"** 또는 **"게시됨"**으로 되어 있으면 OK ✅
   - **"테스트"**로 되어 있으면:
     - 방법 A: 페이지 하단 **"앱 게시"** 버튼 클릭 → **"확인"** (권장)
     - 방법 B: **"테스트 사용자"** 섹션에 본인 Gmail 추가

### ✅ 4단계: OAuth 2.0 클라이언트 ID - 승인된 원본 확인

1. https://console.cloud.google.com/apis/credentials 접속
2. **OAuth 2.0 클라이언트 ID** 섹션에서 해당 클라이언트 ID 클릭:
   ```
   771509966039-vooe355g3k36v9lqu32ulq1nq7d352ne.apps.googleusercontent.com
   ```
3. **승인된 JavaScript 원본**에 다음이 있는지 확인:
   ```
   https://fitecnavy.github.io
   ```
   ⚠️ 주의사항:
   - 정확히 `https://fitecnavy.github.io` (끝에 `/` 없음)
   - `http`가 아닌 `https`
   - 대소문자 정확히 일치

4. 없다면 **"URI 추가"** 클릭하여 추가
5. **"저장"** 클릭

### ✅ 5단계: 브라우저 캐시 삭제 및 대기

1. 브라우저 **시크릿/프라이빗 모드**로 테스트
2. 또는 브라우저 캐시 완전 삭제:
   - Chrome: `Ctrl+Shift+Delete` → 전체 기간 선택 → 삭제
3. **5-10분 대기** (Google 서버 전파 시간)

### ✅ 6단계: 다른 브라우저로 테스트

- Chrome에서 안되면 → Firefox 또는 Edge 시도
- 모바일 브라우저에서도 테스트

## 🔍 추가 진단

### OAuth 동의 화면 설정 확인 방법

https://console.cloud.google.com/apis/credentials/consent 에서:

1. **앱 정보**:
   - 앱 이름: (아무거나 OK)
   - 사용자 지원 이메일: (본인 이메일)
   - 개발자 연락처 정보: (본인 이메일)

2. **범위** (가장 중요!):
   ```
   https://www.googleapis.com/auth/drive.file
   ```
   이 범위가 **반드시** 추가되어 있어야 합니다.

3. **게시 상태**:
   - ✅ **프로덕션** (권장)
   - 또는 **테스트** + 테스트 사용자에 본인 추가

### 설정이 모두 맞는데도 안된다면

1. **프로젝트를 새로 만들어보기**:
   - 새 프로젝트 생성
   - Google Drive API 활성화
   - OAuth 동의 화면 설정 (범위 포함!)
   - 새 클라이언트 ID 생성
   - .env 파일의 클라이언트 ID 변경

2. **Google OAuth Playground로 테스트**:
   - https://developers.google.com/oauthplayground/
   - Scope에 `https://www.googleapis.com/auth/drive.file` 입력
   - 본인 클라이언트 ID 사용하여 테스트

## 🆘 긴급 임시 해결책

위의 모든 방법이 실패하면, 로컬 개발 환경에서 먼저 테스트:

```bash
npm run dev
# http://localhost:3000 접속
```

로컬에서 작동한다면 Google Cloud Console의 승인된 원본 설정 문제입니다.

## 📞 추가 도움

아직도 해결되지 않는다면 다음 정보를 제공해주세요:

1. OAuth 동의 화면 게시 상태: **테스트** / **프로덕션**
2. 범위 목록에 `drive.file`이 있는지: **예** / **아니오**
3. 승인된 JavaScript 원본: (스크린샷 또는 목록)
4. 테스트한 브라우저: Chrome / Firefox / Edge / 기타
5. 브라우저 콘솔 전체 에러 메시지

이 정보가 있으면 더 정확한 해결책을 제시할 수 있습니다.
