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

### 배포 환경(Vercel)에 옮길 때 주의 — 실제로 겪은 함정

**`.env`의 바깥 작은따옴표는 셸 문법입니다. 대시보드에 함께 넣으면 JSON이 아니게 됩니다.**

이 실수로 2026-08까지 배포 환경에서 Admin SDK가 아예 초기화되지 않았고,
학생 응시 채점·루브릭 불러오기·학생 계정 관리가 계속 실패하고 있었습니다.
로컬은 같은 코드로 정상이라 한동안 드러나지 않았습니다.

값을 옮길 때는 화면에 찍지 말고 클립보드로 보내십시오.

```bash
node -e "require('dotenv').config();process.stdout.write(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)" | clip
```

- `{` 로 시작해 `}` 로 끝나는 한 줄이어야 합니다.
- `private_key` 안의 `\n` 은 **글자 그대로** 있어야 합니다. 실제 줄바꿈으로 바꾸면 깨집니다.
- 앞뒤 공백이 붙지 않았는지 확인하십시오.
- Environment 는 **Production** 을 체크해야 실서비스에 적용됩니다.

로컬 `.env` 에 넣을 때는 손으로 붙여넣지 말고 도우미 스크립트를 쓰십시오.

```bash
npx tsx scripts/set-service-account.ts "<다운로드한 서비스계정 JSON 경로>"
```

**환경 변수를 바꿨는데 반영되지 않을 때**: Redeploy 가 빌드 캐시를 재사용하면 새 값이
들어가지 않는 경우가 있었습니다. "Use existing Build Cache" 를 해제하거나 아무 커밋이나
하나 푸시하십시오.

**설정이 잘못됐는지 확인하는 법**: 배포된 주소에 아래를 호출해 봅니다.
정상이면 `{"ok":true}`, 잘못됐으면 `reason` 에 원인이 담겨 옵니다.

```bash
curl -s -X POST "https://<배포주소>/api/session" -H "Content-Type: application/json" -d '{"idToken":"x"}'
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

### 서버 액션 인증 (중요)

Next.js의 서버 액션은 **인증 없이 누구나 POST 할 수 있는 HTTP 엔드포인트**입니다.
액션 ID는 공개된 JS 번들에 그대로 들어 있어 감춰지지도 않습니다.
따라서 Firestore·Storage를 건드리거나 유료 API를 쓰는 액션은 반드시 호출자를 확인해야 합니다.

로그인하면 `/api/session`이 httpOnly 세션 쿠키를 심고, 서버 액션은 `src/lib/auth-guard.ts`의
가드로 그 쿠키를 확인합니다. 브라우저가 쿠키를 자동으로 실어 보내므로 화면 코드는
아무것도 넘길 필요가 없습니다.

```ts
'use server';
import { requireTeacher } from '@/lib/auth-guard';

export async function myAction(input: MyInput) {
  await requireTeacher();   // ← 맨 앞에
  ...
}
```

**새 서버 액션을 만들면 첫 줄에 가드를 넣으십시오.** 빠뜨리면 그 기능이 인터넷에 열립니다.

| 가드 | 쓰는 곳 |
|---|---|
| `requireUser()` | 학생도 쓰는 기능 |
| `requireTeacher()` | 교사 전용 도구 |
| `requireResultAccess(resultId)` | 특정 결과 문서를 읽거나 덮어쓸 때 |
| `requireAssessmentOwner(assessmentId)` | 평가 전체에 영향을 주는 작업 |

가드는 **서버 액션의 본문에서** 부르십시오. Genkit 플로우 안이 아니라 바깥입니다.
`next/headers`의 `cookies()`는 요청 문맥에서만 동작합니다.

운영자용 스크립트(`scripts/`)에서 플로우를 직접 부를 때는 `SPEAKSMART_TRUSTED_SCRIPT=1`을
붙입니다. Vercel에서는 `VERCEL` 환경 변수 때문에 켜지지 않으므로 대시보드에 넣어도 무시됩니다.

```bash
SPEAKSMART_TRUSTED_SCRIPT=1 npx tsx scripts/experiments/some-check.ts
```

### API 키 취급

`src/ai/flows/get-live-session-token.ts`는 실시간 대화(Gemini) 도구를 위해
**API 키 원본을 브라우저로 내려보냅니다.** 지금은 로그인한 사용자로 제한해 두었지만,
그 사용자들의 브라우저에는 키가 남습니다(WebSocket URL의 `?key=`).

임시 토큰(`v1alpha/auth_tokens`)으로 바꾸려 했으나 **발급은 되는데 접속이 거부됩니다.**
`access_token`(v1alpha·v1beta), `Authorization: Token`, 미인코딩 4가지를 시도했고
전부 `unregistered callers`로 닫혔습니다. 같은 조건에서 원본 키는 정상 접속됩니다.

이 도구를 쓰신다면 **Live 전용으로 별도의 키를 발급해 피해 범위를 격리**하는 편이 안전합니다.

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

## 7. 루브릭 채점

교사가 만든 루브릭의 **항목 이름과 배점이 그대로 채점에 사용**됩니다.
항목 개수에도 제한이 없습니다.

### 사용 방법

1. `루브릭 관리`에서 루브릭을 만듭니다. 파일(이미지·PDF)에서 불러올 수도 있습니다.
2. 평가를 만들거나 수정할 때 `루브릭 적용`을 켜고 목록에서 루브릭을 고릅니다.
3. 학생이 응시하면 그 루브릭으로 채점되고, 결과 화면에 항목별 점수와 피드백이 나옵니다.

루브릭을 고르지 않고 켜기만 하면 일반 방식으로 채점됩니다.

### 루브릭 파일에서 기준안 뽑기 — 모델 선택

`루브릭 관리 > 새 루브릭`에서 파일(이미지·PDF)을 올릴 때 **추출에 쓸 AI 모델**을 고를 수 있습니다.
이 선택은 **기준안을 뽑는 데만** 쓰입니다. 학생 채점(`gradeWithRubric`)은 이 선택과 무관하게
`googleai/gemini-3.6-flash`로 고정되어 있으며 이번 변경으로 달라지지 않았습니다.

목록의 설명 문구는 실제로 비교한 결과입니다. 4항목·12수준짜리 한글 채점 기준표를
PNG와 PDF로 만들어 9개 모델에 넣고 항목명·배점·수준 점수·설명 문구를 정답과 대조했습니다.

| 파일 형식 | 결과 |
|---|---|
| 이미지(PNG) | gemini 2종, gpt-5.6 2종, claude 3종이 만점 |
| PDF | **Claude 4종 전부 실패** — Anthropic API가 PDF를 받지 않아 400을 돌려줍니다 |

- `claude-haiku-4-5`는 한글을 반복해서 잘못 읽습니다(`유창성`→`유성성`, `참여`→`창의`).
- `gpt-4o`는 PDF에서 **원문에 없는 수준 설명을 지어냈습니다.** 교사가 알아채기 어려운
  종류의 오류라 선택 목록에서 뺐습니다.
- PDF를 올린 상태에서 Claude를 고르면 호출하기 전에 막고 안내합니다.

**Claude 선택지는 `ANTHROPIC_API_KEY`가 서버 환경 변수에 있어야 동작합니다.**
없으면 플러그인 자체가 등록되지 않습니다(`src/ai/genkit.ts`).

무엇을 고를지 애매하면 기본값(`gemini-3.1-pro-preview`)이나 `gpt-5.6-terra`를 쓰십시오.
정확도는 같고 후자가 3배쯤 빠릅니다.

### 점수 환산 방식

- 각 항목은 루브릭에 적힌 배점을 그대로 따릅니다 (예: 30점 만점 항목).
- **내용 점수**는 총점을 100점 만점으로 환산한 값입니다.
- **발음 점수**는 루브릭에 발음·억양 항목이 있으면 그 항목을 환산해 씁니다.
  글쓰기 루브릭처럼 발음 항목이 없으면 총점 환산값을 대신 씁니다.

### 예전에 채점된 결과

2026-08 이전에 루브릭으로 채점된 결과(약 20건)는 항목이 5개로 고정된
옛 형식(`rubricScores`)으로 저장되어 있습니다. 결과 화면은 이 형식도 계속
표시하며, 카드 하단에 옛 방식임을 안내합니다. 정확한 점수가 필요하면
해당 평가를 다시 채점하십시오.

당시에는 채점 결과가 **모두 0점으로 기록되는 문제**가 있었습니다.
프롬프트는 영어로 리포트를 만들게 하면서 점수는 한글 항목명으로 찾는
구조였기 때문입니다. 지금은 모델이 항목별 점수를 구조화된 값으로 직접
돌려주므로 이 문제가 없습니다. **0점으로 남아 있는 과거 결과는
실제 실력이 아니라 이 버그의 결과이므로 재채점을 권합니다.**

### 관련 파일

- `src/ai/flows/grade-with-rubric.ts`: 루브릭 채점 (항목별 구조화 출력)
- `src/ai/flows/load-rubric-flow.ts`: 평가에 연결된 루브릭 불러오기
- `src/lib/rubric-summary.ts`: 채점 결과를 표·요약으로 변환
- `src/components/rubric-result-card.tsx`: 결과 화면 표시 (구형식 호환)

## 7-2. 평가에 쓸 모델 고르기

모델 목록이 용도에 따라 셋으로 나뉘어 있습니다 (`src/lib/types.ts`).
13종을 전부 실제로 응시시켜 확인한 결과를 반영한 것입니다.

| 목록 | 개수 | 어디에 쓰이나 |
|---|---|---|
| `assessmentEvaluationModels` | 5 | 평가 만들기·수정의 `AI 평가 모델` |
| `rubricAnalysisModels` | 8 | 루브릭 파일에서 기준안 뽑기 |
| `evaluationModels` | 13 | 교사 도구 (손글씨·PDF·유튜브·발표 등) |

**학생 녹음을 스스로 듣는 것은 Gemini 뿐입니다.** OpenAI와 Claude는 오디오를 400으로 거부합니다.
그래서 평가 목록에는 Gemini 2종과 gpt-5.6 3종만 두었고, 각 항목에 무엇을 스스로 하는지
적어 두었습니다.

- `gemini-3.6-flash`, `gemini-3.1-pro-preview` — 전 과정을 스스로 처리
- `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.6-sol` — **내용 채점만.** 전사와 발음 점수는 Gemini가 매깁니다

즉 GPT를 고르셔도 발음 점수는 Gemini가 준 값입니다. 발음 채점 모델을 비교하는 용도로는
쓸 수 없습니다.

### 오디오 실패 시 자동 대체

오디오를 넘기는 호출(전사·발음 분석)이 실패하면 `googleai/gemini-3.1-pro-preview`로
한 번 더 시도합니다 (`src/lib/ai-retry.ts`). 전사가 실패하면 채점을 아예 못 하고
학생이 다시 응시해야 하기 때문입니다.

실제로 2026-08에 `gemini-3.6-flash`가 오디오 입력에만 500을 돌려주는 일이 있었고
(텍스트·이미지는 정상), 이 대체 덕분에 응시가 끝까지 완료됐습니다.
대체가 걸리면 서버 로그에 다음과 같이 남습니다.

```
[전사] googleai/gemini-3.6-flash 실패 → googleai/gemini-3.1-pro-preview 로 대체합니다: ...
```

대체가 걸리는 동안에는 응시 처리가 20~40초로 조금 느려집니다.

## 8. 장애 조치 (Troubleshooting)

- **도구가 "로그인이 필요합니다"로 막힐 때**: 세션 쿠키가 없거나 만료된 상태입니다.
  로그아웃 후 다시 로그인하면 `/api/session`이 쿠키를 새로 심습니다.
- **AI 응답 속도가 느릴 때**: `src/ai/flows/text-to-speech.ts`에서 모델을 `gemini-1.5-flash-latest`로 변경하면 속도가 향상됩니다.
- **로그인이 되지 않을 때**: `npm run seed`로 계정을 생성했는지, 기존 환경이라면 `npm run migrate:auth -- --apply`를 실행했는지 확인하십시오.
- **Firebase 권한 오류**: `firestore.rules` / `storage.rules`를 배포했는지 확인하십시오 (`firebase deploy --only firestore:rules,storage`).
- **비밀번호 초기화·학생 삭제 실패**: `FIREBASE_SERVICE_ACCOUNT_KEY`가 서버 환경 변수에 설정되어 있어야 합니다.
