# SpeakSmart AI 평가도구 운영 및 이관 가이드

이 문서는 본 애플리케이션을 새로운 환경(Firebase Studio, 로컬 개발 환경 등)으로 이관하여 즉시 운영하기 위한 지침서입니다.

## 1. 필수 사전 요구사항

운영을 위해 다음 서비스들의 계정과 설정이 필요합니다.
- **Firebase 프로젝트**: Firestore, Storage, Authentication(이메일/비밀번호) 활성화 필요.
- **Google AI API 키**: [Google AI Studio](https://aistudio.google.com/)에서 Gemini 모델용 API 키 발급.
- **Node.js**: v18 이상 권장.

## 2. 환경 변수 설정 (.env)

새로운 환경의 루트 폴더에 `.env` 파일을 생성하고 다음 항목들을 입력해야 합니다. (상세 값은 Firebase 콘솔 확인)

```env
# Firebase Client SDK Config
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_PROJECT_ID.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_PROJECT_ID.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"

# Google AI (Gemini) Config
# Genkit이 이 키를 사용하여 AI 모델을 호출합니다.
GOOGLE_GENAI_API_KEY="YOUR_GEMINI_API_KEY"

# (옵션) OpenAI Config - GPT 모델 사용 시 필요
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
```

## 3. 데이터베이스 초기화 (중요)

새로운 Firebase 환경으로 옮기면 데이터베이스(Firestore)가 비어 있습니다. 
애플리케이션 내에 포함된 `src/lib/seed-data.ts`를 실행하거나, 해당 로직을 임시로 페이지에 연결하여 호출하면 다음 데이터가 자동으로 생성됩니다.

- **교사 계정**: 이름 'Great Teacher', 암호 '2918'
- **학생 계정**: 일학생, 이학생, 삼학생 (기본 암호 '123456')
- **샘플 평가**: '자기소개 하기', '음식 주문하기(대화형)' 등

## 4. 실행 및 배포

### 로컬 실행
```bash
npm install
npm run dev
```

### Genkit 개발자 UI 실행 (프롬프트 테스트)
```bash
npm run genkit:dev
```

## 5. 주요 파일 구조 설명

- `src/ai/flows/`: 모든 AI 핵심 로직 (채점, 대화 생성, 발음 분석 등)
- `src/app/(student)`: 학생용 페이지 (대시보드, 평가 응시)
- `src/app/(teacher)`: 교사용 페이지 (평가 관리, 결과 분석, 루브릭)
- `src/lib/firebase.ts`: Firebase 연결 설정
- `src/lib/types.ts`: 시스템 전체에서 사용하는 데이터 타입 정의

## 6. 장애 조치 (Troubleshooting)

- **AI 응답 속도가 느릴 때**: `src/ai/flows/text-to-speech.ts`에서 모델을 `gemini-1.5-flash-latest`로 변경하면 속도가 향상됩니다.
- **Firebase 권한 오류**: Firebase 콘솔의 Firestore/Storage 규칙(Rules)이 공개 읽기/쓰기가 허용되어 있는지 확인하십시오.
