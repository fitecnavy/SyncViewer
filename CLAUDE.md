# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

SyncViewer는 Google Drive를 통해 읽기 위치를 자동 동기화하는 크로스 디바이스 텍스트 뷰어입니다. PC에서 읽던 책을 모바일에서 같은 위치부터 이어서 읽을 수 있습니다.

## 기술 스택

- React 18 + TypeScript
- Vite 5.0.8 (빌드 도구)
- Google Drive API v3 + OAuth 2.0
- IndexedDB (`idb` 라이브러리) - 로컬 캐싱
- Vitest - 테스트
- 인라인 React CSSProperties - 스타일링 (CSS 프레임워크 미사용)

## 명령어

```bash
npm run dev          # 개발 서버 실행 (포트 3000)
npm run build        # TypeScript 검사 + 프로덕션 빌드
npm run lint         # ESLint (엄격 모드: --max-warnings 0)
npm test             # Vitest 감시 모드
npm run test:run     # Vitest 단일 실행 (CI용)
npm run test:ui      # Vitest UI 대시보드
npm run deploy       # 빌드 + GitHub Pages 배포
```

## 아키텍처

### 서비스 레이어 (싱글톤 패턴)

`src/services/`의 모든 서비스는 `getInstance()` 싱글톤 패턴 사용:

- **GoogleDriveService** (`googleDrive.ts`): Google Drive API 래퍼. `SyncViewer_Library` (텍스트 파일)와 `SyncViewer_Progress` (JSON 진행 파일) 두 폴더 관리. 청크 단위 업로드/다운로드 처리.

- **FileCacheService** (`fileCache.ts`): IndexedDB 청크 기반 캐싱. 512KB 청크, 최대 10MB 캐시, LRU 정리. 부드러운 스크롤을 위해 현재 위치 앞뒤 2개 청크 미리 로드.

- **SyncService** (`sync.ts`): 크로스 디바이스 동기화. 30초 자동 동기화 주기, 읽는 중 5초마다 저장. localStorage와 Google Drive 조정; 최신 타임스탬프 우선.

### 컴포넌트 구조

`App.tsx`에서 관리하는 3개 뷰 시스템:
- `GoogleAuth`: OAuth 로그인/로그아웃
- `Library`: 책 목록, 업로드, 삭제
- `TextViewer`: 스크롤 기반 위치 추적 읽기 인터페이스

### 주요 타입 (src/types/index.ts)

- `Book`: Google Drive 파일 ID를 포함한 텍스트 파일 메타데이터
- `ReadingProgress`: 바이트 오프셋, 퍼센트, 타임스탬프로 위치 추적
- `FileCacheChunk`: 캐시된 파일 세그먼트용 IndexedDB 스키마

## 설정

Google API 자격 증명은 `.env`에 설정:
```
VITE_GOOGLE_API_KEY=your_api_key
VITE_GOOGLE_CLIENT_ID=your_client_id
```

`src/config/google.ts`에서 `import.meta.env.VITE_*` 패턴으로 로드.

## 코드 컨벤션

- 모든 컴포넌트는 `React.FC<Props>` 함수형 패턴 사용
- 모든 비동기 작업에 async/await 사용
- TypeScript strict 모드 활성화
- gapi 타입 문제로 `@typescript-eslint/no-explicit-any: off` 설정
