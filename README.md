# SyncViewer

구글 드라이브를 통해 PC와 모바일 간 동기화가 가능한 텍스트 뷰어

## 주요 기능

### 1. 서재 기능
- 텍스트 파일(.txt)을 서재에 등록
- Google Drive를 통한 파일 공유 및 관리
- PC와 모바일 간 서재 자동 동기화

### 2. 읽기 위치 동기화
- 파일을 읽는 중 위치 자동 저장
- PC에서 읽던 위치를 모바일에서 이어서 읽기 가능
- 30초마다 자동 동기화 (로컬 + Google Drive)

### 3. 메모리 효율적인 파일 로딩
- 대용량 파일도 부담 없이 읽기
- 청크 단위(512KB)로 파일 분할 로딩
- 읽기 위치 기준 필요한 부분만 로드
- IndexedDB를 활용한 로컬 캐싱

## 기술 스택

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Cloud Storage**: Google Drive API
- **Local Storage**: IndexedDB (idb)
- **Styling**: Inline CSS (React CSSProperties)

## 시작하기

### 1. 환경 설정

Google Cloud Console에서 프로젝트를 생성하고 API 설정:

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성
3. "API 및 서비스" > "사용자 인증 정보"로 이동
4. "API 키" 생성
5. "OAuth 2.0 클라이언트 ID" 생성
   - 애플리케이션 유형: 웹 애플리케이션
   - 승인된 JavaScript 원본: `http://localhost:3000`
   - 승인된 리디렉션 URI: `http://localhost:3000`
6. Google Drive API 활성화

### 2. 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env

# .env 파일을 열어 Google API 키와 클라이언트 ID 입력
```

### 3. 실행

```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 http://localhost:3000 접속
```

### 4. 빌드

```bash
# 프로덕션 빌드
npm run build

# 빌드된 파일 미리보기
npm run preview
```

## 프로젝트 구조

```
SyncViewer/
├── src/
│   ├── components/
│   │   ├── Auth/              # Google 인증
│   │   │   └── GoogleAuth.tsx
│   │   ├── Library/           # 서재
│   │   │   └── Library.tsx
│   │   └── TextViewer/        # 텍스트 뷰어
│   │       └── TextViewer.tsx
│   ├── services/
│   │   ├── googleDrive.ts     # Google Drive API
│   │   ├── fileCache.ts       # 파일 캐싱
│   │   └── sync.ts            # 동기화
│   ├── types/
│   │   └── index.ts           # 타입 정의
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 사용 방법

### 1. 로그인
- Google 계정으로 로그인

### 2. 책 추가
- "책 추가" 버튼 클릭
- 텍스트 파일(.txt) 선택
- 자동으로 Google Drive에 업로드됨

### 3. 책 읽기
- 서재에서 책을 선택하여 열기
- 스크롤하며 읽기
- 읽기 위치가 자동으로 저장됨

### 4. 기기 간 동기화
- 다른 기기에서 같은 Google 계정으로 로그인
- 서재에서 같은 책을 열면 이전에 읽던 위치에서 시작

### 5. 위치 이동
- "위치 이동" 버튼으로 특정 % 위치로 이동 가능

## 캐시 설정

파일 캐시는 `src/services/fileCache.ts`에서 설정 가능:

```typescript
{
  chunkSize: 512 * 1024,        // 청크 크기 (512KB)
  preloadChunks: 2,              // 미리 로드할 청크 개수
  maxCacheSize: 10 * 1024 * 1024 // 최대 캐시 크기 (10MB)
}
```

## 주의사항

- 현재 텍스트 파일(.txt)만 지원
- Google Drive API 할당량 제한 확인 필요
- 대용량 파일(수백 MB 이상)의 경우 초기 로딩에 시간이 걸릴 수 있음

## 라이선스

MIT
