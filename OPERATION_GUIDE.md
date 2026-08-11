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

# 서버 전용 관리자 자격증명 (초기 데이터 생성, 학생 비밀번호 초기화/삭제에 필요)
# Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성 으로 받은 JSON을 한 줄로 붙여넣습니다.
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"..."}'
```

## 3. 인증 구조

로그인은 **Firebase Authentication**을 사용합니다. 학생은 이름(아이디)과 비밀번호로 로그인하지만,
Firebase Auth는 이메일을 요구하므로 이름을 결정적으로 변환한 내부 주소(`u<해시>@speaksmart.local`)를 사용합니다.
이 변환은 `src/lib/auth-email.ts`에 있으며, 덕분에 로그인 전에 `users` 컬렉션을 조회할 필요가 없어
사용자 정보를 완전히 비공개로 잠글 수 있습니다.

- 비밀번호는 Firebase Auth가 보관하며 **Firestore에는 저장하지 않습니다.**
- 이름은 로그인 아이디이므로 프로필 화면에서 변경할 수 없습니다.
- 학생 비밀번호 초기화·계정 삭제는 교사만 가능하며, 서버에서 ID 토큰과 역할을 검증합니다
  (`src/app/teacher/students/actions.ts`).

## 4. 데이터베이스 초기화 (중요)

새로운 Firebase 환경으로 옮기면 데이터베이스(Firestore)가 비어 있습니다.
`FIREBASE_SERVICE_ACCOUNT_KEY`를 설정한 뒤 다음을 실행하면 Auth 계정과 Firestore 문서가 함께 생성됩니다.

```bash
npm run seed
```

- **교사 계정**: 이름 'Great Teacher', 암호 '2918'
- **학생 계정**: 일학생, 이학생, 삼학생 (기본 암호 '123456')
- **샘플 평가**: '자기소개 하기 (Sample)'

### 기존 데이터가 있는 환경에서 이관하는 경우

예전 버전은 비밀번호를 Firestore에 평문으로 저장했습니다. 아래 마이그레이션을 한 번 실행하면
기존 `users` 문서마다 같은 UID의 Auth 계정을 만들고 문서에서 `password` 필드를 제거합니다.
문서 ID를 그대로 UID로 쓰므로 기존 평가·결과 데이터의 참조는 손상되지 않습니다.

```bash
npm run migrate:auth
```

먼저 위 명령으로 무엇이 바뀔지 확인한 뒤, 실제 적용은 다음과 같이 실행합니다.

```bash
npm run migrate:auth -- --apply
```

## 5. 실행 및 배포

### 로컬 실행
```bash
npm install
npm run dev
```

### Genkit 개발자 UI 실행 (프롬프트 테스트)
```bash
npm run genkit:dev
```

## 6. 주요 파일 구조 설명

- `src/ai/flows/`: 모든 AI 핵심 로직 (채점, 대화 생성, 발음 분석 등)
- `src/app/(student)`: 학생용 페이지 (대시보드, 평가 응시)
- `src/app/(teacher)`: 교사용 페이지 (평가 관리, 결과 분석, 루브릭)
- `src/lib/firebase.ts`: Firebase 연결 설정 (클라이언트)
- `src/lib/firebase-admin.ts`: 서버 전용 Admin SDK 연결 설정
- `src/lib/auth-email.ts`: 이름(아이디) → Firebase Auth 로그인 주소 변환
- `src/lib/types.ts`: 시스템 전체에서 사용하는 데이터 타입 정의
- `scripts/seed.ts`, `scripts/migrate-auth.ts`: 운영자용 일회성 스크립트

### `workspace/` 폴더 — 정리 필요

`workspace/`에는 `src/`에 있는 파일 3개의 **오래된 사본**이 들어 있습니다.
빌드에는 포함되지 않지만 `tsconfig.json`의 검사 범위(`**/*.ts`)에 걸려
타입 검사 오류 6건을 만들고 있습니다.

| 사본 | 원본과의 차이 |
|---|---|
| `workspace/src/ai/flows/create-neural2-teacher-flow.ts` | 54줄 |
| `workspace/src/app/teacher/conversation-tools/page.tsx` | 76줄 |
| `workspace/src/lib/firebase.ts` | 2줄 |

**원본은 항상 `src/` 쪽입니다.** `workspace/` 사본은 참조하지 마십시오.
차이가 큰 것은 그만큼 오래되었다는 뜻이며, 여기서 코드를 가져다 쓰면
이미 고친 문제가 되살아납니다.

정리 방법은 두 가지입니다.

1. **폴더째 삭제** (권장) — 사본에 남기고 싶은 내용이 없다면 가장 깨끗합니다.
   ```bash
   git rm -r workspace
   ```
2. **검사 범위에서 제외** — 기록으로 남겨두고 싶다면 `tsconfig.json`의
   `exclude`에 `"workspace"`를 추가합니다. 타입 오류는 사라지지만
   사본이 계속 남아 혼동의 소지는 유지됩니다.

`workspace/.env.local`에는 실제 키가 들어 있으나 `.gitignore`의 `.env*` 규칙으로
저장소에는 올라가지 않습니다. 폴더를 지울 때 이 파일도 함께 사라지므로,
아직 쓰는 값이 있다면 먼저 확인하십시오.

## 7. 루브릭 기능 현황 — 알려진 문제

교사가 만든 루브릭은 **저장까지만 되고 채점에는 전혀 반영되지 않습니다.**
2026-08 검토에서 확인된 내용이며, 사용 전 반드시 알고 계셔야 합니다.

### 끊긴 지점

| 단계 | 상태 |
|---|---|
| 루브릭 작성·저장 (`rubrics` 컬렉션) | 정상 |
| 평가 생성 시 루브릭 선택 (`loadedRubricId` 저장) | 저장은 됨 |
| 채점 시 루브릭 불러오기 | **없음** — `loadedRubricId`를 읽는 코드가 어디에도 없습니다 |
| 채점 프롬프트에 루브릭 전달 | **없음** — 학생 답변만 전달합니다 |

채점 플로우는 `useRubric`(켬/끔) 값만 받고, 평가 항목은
`Fluency, Pronunciation, Grammar, Vocabulary`로 **프롬프트에 고정**되어 있습니다.
교사가 항목 이름이나 배점을 어떻게 정해도 결과는 동일합니다.

### 점수가 항상 0점으로 기록되는 문제

프롬프트는 영어로 지시하므로 모델이 **영어 제목의 HTML**을 만들어 냅니다.
그런데 점수 추출 코드는 **한글 항목명**을 찾습니다.

```
정규식: /유창성[\s\S]*?점수[^\d]*(\d)/
실제 출력: <h2>Fluency</h2> ... (한글 없음)
```

그 결과 네 항목 모두 0점으로 파싱되고, 다음처럼 기록됩니다.

```
내용 점수 0점 / 발음 점수 0점
생기부 문구: "'평가명' 루브릭 평가 종합 0점, 발음 0점 성취함."
```

**루브릭 채점을 켠 평가는 점수를 신뢰할 수 없습니다.** 수정 전까지는
루브릭 옵션을 끄고 사용하시기를 권합니다.

### 데이터 모델 불일치

두 모델이 서로 맞지 않아, 루브릭을 제대로 반영하려면 함께 손봐야 합니다.

| 모델 | 형태 |
|---|---|
| `rubrics` 문서 | 항목 개수·이름·배점이 자유로움 (`criteria[]`) |
| `RubricScores` 타입 | `fluency`, `pronunciation`, `grammar`, `vocabulary`, `interaction` 5개 고정 |

교사가 "발표 태도" 같은 항목을 만들어도 담을 자리가 없습니다.

### 그 밖에

- 평가 **수정** 화면에서는 루브릭을 바꿀 수 없습니다. 생성 시에만 선택 가능합니다.
- 파일에서 루브릭을 읽어오는 기능(`analyze-rubric-file-flow`)은 정상 동작합니다.

## 8. 장애 조치 (Troubleshooting)

- **AI 응답 속도가 느릴 때**: `src/ai/flows/text-to-speech.ts`에서 모델을 `gemini-1.5-flash-latest`로 변경하면 속도가 향상됩니다.
- **로그인이 되지 않을 때**: `npm run seed`로 계정을 생성했는지, 기존 환경이라면 `npm run migrate:auth -- --apply`를 실행했는지 확인하십시오.
- **Firebase 권한 오류**: `firestore.rules` / `storage.rules`를 배포했는지 확인하십시오 (`firebase deploy --only firestore:rules,storage`).
- **비밀번호 초기화·학생 삭제 실패**: `FIREBASE_SERVICE_ACCOUNT_KEY`가 서버 환경 변수에 설정되어 있어야 합니다.
