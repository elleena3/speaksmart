# 작업 인수인계 (2026-08-11)

이 문서는 대화창을 새로 열어 작업을 이어가기 위한 것입니다.
운영 방법은 [OPERATION_GUIDE.md](./OPERATION_GUIDE.md)에 있으니 그쪽을 먼저 읽으십시오.
여기에는 **왜 그렇게 되어 있는지**와 **아직 남은 일**만 적습니다.

---

## 1. 이 프로젝트

**SpeakSmart** — Next.js 15 + Firebase + Genkit 기반 영어 말하기 평가 플랫폼.
학생이 영어로 말하면 AI가 채점하고 교사에게 생활기록부 문구까지 만들어 줍니다.

- 배포: Vercel (GitHub `elleena3/speaksmart` main 브랜치 자동 배포)
- Firebase 프로젝트: **`speaksmart-evaluator2`** (`.firebaserc`의 `speaksmart-evaluator`는 다른 프로젝트였고 이번에 바로잡음)
- 실제 데이터: 학생 47명 + 테스트 학생 3명 + 교사 1명, 평가 8건, 결과 169건

---

## 2. 이번 세션에서 한 일 (커밋 26개)

### 인증 — 가장 큰 변경

**이전**: 로그인이 Firestore를 직접 조회했고 **비밀번호가 평문으로 저장**되어 있었습니다.
`request.auth`가 항상 null이라 보안 규칙을 걸 수 없는 구조였습니다.

**현재**: Firebase Auth로 이관 완료. 학생 47명 + 교사 1명 마이그레이션했고 평문 비밀번호는 0건입니다.

- 이름(한글) → Auth 이메일 변환: [src/lib/auth-email.ts](src/lib/auth-email.ts)
  덕분에 로그인 전에 `users`를 읽을 필요가 없어 컬렉션을 완전히 잠글 수 있습니다.
- Firestore 문서 ID = Auth UID로 맞춰서 기존 참조(평가·결과·루브릭)가 그대로 살아 있습니다.
- 교사 로그인: 이름 `Great Teacher` / 비밀번호 `29182918`
  (Firebase가 6자 이상을 요구해 기존 `2918`에서 변경)
- 학생: 이름·비밀번호 모두 기존 그대로

### 보안 규칙

`firestore.rules` / `storage.rules`를 소유자·역할 기반으로 다시 쓰고 배포했습니다.
비로그인 접근 차단, 학생은 본인 결과만, 교사는 담당 데이터만 접근합니다.

규칙을 잠그기 전에 **AI 플로우 4개가 서버에서 클라이언트 SDK를 쓰고 있어서** 먼저
Admin SDK로 옮겨야 했습니다 ([src/lib/server-store.ts](src/lib/server-store.ts)).

배포는 `npx tsx scripts/deploy-rules.ts --apply`로 합니다.
firebase CLI는 배포 전 `serviceusage` API를 조회하는데 서비스 계정에 그 권한이 없어 막힙니다.

### 되풀이된 근본 원인 두 가지

이 세션에서 여러 기능이 죽어 있던 원인은 대부분 이 둘로 수렴했습니다.

**(1) 모델명에 네임스페이스 접두사 누락**
Genkit은 `googleai/gemini-3.6-flash`처럼 찾습니다. `gemini-3.6-flash`는 무조건 `NOT_FOUND`.
플로우 전체에 35곳이 접두사 없이 적혀 있었고, 호출 시 덮어쓰지 않는 플로우는 전부 실행 불가였습니다.
이미지 생성, 따라 읽기, 성장 피드백, 생기부 재생성 등이 여기 걸려 있었습니다.

**(2) `'use server'` 파일에서 async 함수 외의 것을 export**
상수 하나를 export하면 **그 모듈의 모든 서버 액션이 런타임에 깨집니다.**
페이지는 정상 렌더링되는데 버튼만 500이 나서 원인 찾기가 어렵습니다. 두 번 겪었습니다.
상수는 반드시 일반 모듈(`src/lib/`)에 두십시오.

### 각 공급자가 받는 미디어 (실측)

| 미디어 | Gemini | OpenAI | Claude |
|---|---|---|---|
| 텍스트·이미지 | O | O | O |
| PDF | O | O | **X** |
| 음성 | O | X (전사 API는 별도로 가능) | X |
| 동영상 | O | X | X |

이 표 때문에 동영상 분석과 음성 도구는 Gemini만 선택지에 둡니다.
OpenAI는 `/v1/audio/transcriptions`로 **받아쓰기는 가능**하나 아직 연결하지 않았습니다.

### 실시간 대화 도구

- OpenAI Realtime을 GA 스키마로 교체 (`output_modalities`, `audio.output.voice`, `audio.input.turn_detection`)
- Chrome은 WebRTC 원격 스트림을 `<audio>` 엘리먼트에 붙이지 않으면 소리가 나지 않습니다
- **발음 평가 추가**: 학생 마이크만 따로 녹음해 Gemini가 채점합니다
  (합본 녹음에는 AI 목소리가 섞여 있어 그대로 쓰면 AI를 채점하게 됩니다)
- Gemini 도구의 자막이 Web Speech(마이크 직청)에만 의존해 **AI 목소리가 학생 발화로 기록**될 수 있었습니다.
  서버 전사(`inputAudioTranscription`)를 켜서 출처 단위로 분리했습니다.

### 루브릭 — 전면 재작업

**이전**: 저장은 되지만 채점에 전혀 반영되지 않았습니다. `loadedRubricId`를 읽는 코드가 없었고,
평가 항목이 프롬프트에 고정되어 있었으며, 영어 리포트를 한글 정규식으로 파싱해 **점수가 0점**이 됐습니다.

**현재**: 교사가 만든 항목·배점이 그대로 채점에 쓰입니다.

- [grade-with-rubric.ts](src/ai/flows/grade-with-rubric.ts) — 구조화 출력으로 채점 (파싱 없음)
- [load-rubric-flow.ts](src/ai/flows/load-rubric-flow.ts) — 응시·재시도·전체재채점 공통
- `RubricEvaluation` 신설. 기존 `RubricScores`(고정 5필드)는 `@deprecated`로 남겨 과거 결과 20건 계속 표시

### 정리 작업

- 죽은 코드 28개 파일 삭제 (도달 가능성 분석 후 검토)
- 도구 간 중복 `id` 6그룹 → `useId()`로 해결 (PDF 채점 도구가 다른 도구의 입력을 지우던 실제 버그)
- 타입 에러 91 → 42건

---

## 2-2. 다음 세션에서 한 일 (2026-08-11 ~ 12)

### 서버 액션 인증 — 가장 큰 변경

**이전**: `'use server'` 모듈 36개 중 호출자를 확인하는 것은 `students/actions.ts` 하나뿐이었습니다.
서버 액션은 누구나 POST 할 수 있는 엔드포인트이고 액션 ID는 공개 JS 번들에 그대로 들어 있습니다.

**특히 `getLiveSessionToken()`이 `GOOGLE_GENAI_API_KEY` 원본을 그대로 반환하고 있었습니다.**
배포된 번들에 액션 ID가 있는 것을 확인했습니다. 노출된 키는 그 뒤 교체했습니다(아래 제약 참조).

**현재**: 로그인 시 httpOnly 세션 쿠키를 발급하고([src/app/api/session/route.ts](src/app/api/session/route.ts)),
서버 액션은 [src/lib/auth-guard.ts](src/lib/auth-guard.ts)의 가드로 확인합니다.
액션마다 `idToken` 인자를 받게 하면 호출부 40여 곳을 고쳐야 하고 새 액션에서 빠뜨리기 쉬워
쿠키 방식을 택했습니다. **새 서버 액션을 만들면 첫 줄에 가드를 넣으십시오.**

| 가드 | 쓰는 곳 |
|---|---|
| `requireUser()` | 학생 화면도 부르는 5개 (TTS·대화, 성장 피드백, 루브릭 채점·읽기, 대화 요약) |
| `requireTeacher()` | 교사 전용 23개 (손글씨·PDF·유튜브·발표·발음 도구, 이미지 생성 등) |
| `requireResultAccess(resultId)` | 응시·대화 분석, 재시도 — 본인 결과이거나 담당 교사만 |
| `requireAssessmentOwner(id)` | 전체 재채점 — 평가를 만든 교사만 |

운영 스크립트는 `SPEAKSMART_TRUSTED_SCRIPT=1`로 우회합니다. Vercel에서는 `VERCEL` 환경 변수
때문에 켜지지 않으므로 실수로 대시보드에 넣어도 무시됩니다.

### 평가 모델 목록을 능력에 맞게 정리

13종을 전부 실제로 응시시켜 확인했습니다. **학생 녹음을 스스로 받는 것은 Gemini 뿐**이고
OpenAI·Claude는 400으로 거부합니다. 오디오 대체가 있어 채점은 끝까지 완료되지만
그 경우 전사와 발음 점수는 Gemini가 매깁니다. 목록을 5종으로 줄이고 무엇을 스스로
하는지 라벨에 적었습니다. 뺀 것: Claude 4종, 구형 `gpt-4o`·`gpt-4o-mini`·`o3-mini`·`o1`.

목록이 세 갈래로 나뉘었습니다 ([src/lib/types.ts](src/lib/types.ts)).

| 목록 | 개수 | 용도 |
|---|---|---|
| `assessmentEvaluationModels` | 5 | 평가(응시) — Gemini 2 + gpt-5.6 3 |
| `rubricAnalysisModels` | 8 | 루브릭 파일 분석 — Claude 포함 |
| `evaluationModels` | 13 | 교사 도구 — 오디오를 안 쓰므로 제약 없음 |

### 오디오 실패에 대한 대비

`gemini-3.6-flash`가 오디오 입력에만 500을 돌려주는 일이 있었습니다(텍스트·이미지는 정상).
이 모델이 평가 기본값이라 학생 응시가 그대로 실패했습니다. 재시도 조건이 503뿐이라
500은 재시도조차 되지 않았습니다.

[src/lib/ai-retry.ts](src/lib/ai-retry.ts)로 규칙을 모았습니다.

- 재시도 대상을 500/INTERNAL/429/UNAVAILABLE까지 확대
- 오디오를 넘기는 호출은 실패 시 `googleai/gemini-3.1-pro-preview`로 자동 대체
  (전사가 실패하면 학생이 다시 응시해야 하기 때문)

### 루브릭 파일 분석에 모델 선택 추가

`루브릭 관리 > 새 루브릭`에서 추출에 쓸 모델을 고를 수 있습니다. 채점은 영향받지 않습니다.
자세한 비교 결과는 OPERATION_GUIDE 7장에 있습니다.

---

## 3. 지금 상태

| 항목 | 상태 |
|---|---|
| 빌드 | 통과 |
| 타입 에러 | 36건 (`workspace/` 삭제로 6건 감소) |
| 작업 트리 | 깨끗함, 모두 푸시됨 |
| 최신 커밋 | `5c054ec` |
| 배포 | 반영 확인 (프로덕션에서 인증·Admin SDK·AI 호출 모두 정상) |

---

## 4. 남은 일

### 배포 후 실제 확인이 필요한 것

코드와 플로우는 검증했지만 **브라우저에서 마이크가 차단되어** 끝까지 못 본 것들입니다.

1. **실시간 대화 발음 평가** — 대화 후 발음 카드가 뜨는지, 점수가 합리적인지
2. **AI 음성 재생** — `<audio>` 엘리먼트 수정 후 실제로 들리는지
3. ~~**루브릭 채점 전 과정**~~ — 2026-08-11 서버 쪽 전 경로 검증 완료. 아래 참조.
4. **녹음 보관** — 대화 후 Storage 업로드와 보관 링크
   (monologue 업로드는 아래 버그를 고치고 실제로 확인했습니다. 실시간 대화 도구 쪽은 미확인)
5. ~~**세션 쿠키**~~ — 프로덕션에서 발급·검증 확인 완료. 다만 배포 전에 로그인해 둔
   브라우저는 쿠키가 없을 수 있습니다. "로그인이 필요합니다"가 뜨면 다시 로그인하면 됩니다.
6. **학생 응시 한 번** — 오디오 대체와 녹음 업로드 수정이 실제 마이크 녹음에서도 통하는지.
   서버 쪽은 브라우저가 만드는 것과 같은 형식으로 검증했지만 마이크 경로는 미확인입니다.

### 배포 환경만 다르게 동작할 때 — 실제로 겪은 함정

**증상**: 로컬에서는 전부 정상인데 배포하면 특정 기능만 실패. 프로덕션은 서버 액션이
던진 오류 메시지를 `digest`로 가려서 화면에는 원인이 안 뜹니다.

**실제 사례 (2026-08-12)**: Vercel의 `FIREBASE_SERVICE_ACCOUNT_KEY`가 **설정은 되어
있으나 JSON이 깨진** 상태였습니다. 그 결과 Admin SDK가 배포 환경에서 한 번도 동작하지
않았고, 학생 응시 채점·루브릭 불러오기·학생 계정 관리가 계속 실패하고 있었습니다.
로컬은 같은 코드로 멀쩡해서 드러나지 않았습니다.

원인은 `.env`의 **바깥 작은따옴표까지 복사한 것**으로 보입니다. 셸 문법이라 대시보드에
넣으면 JSON이 아니게 됩니다. 값을 옮길 때는 화면에 찍지 말고 클립보드로 보내십시오.

```bash
node -e "require('dotenv').config();process.stdout.write(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)" | clip
```

**진단 방법**: 원인을 알 수 없는 500·401이 나오면, 오류를 던지지 말고 **원인을 응답에
담아 돌려주십시오.** Firebase 오류 코드나 초기화 실패 사유는 비밀이 아닙니다.
`/api/session`과 `analyzeRubricFile`이 이 방식으로 되어 있으니 참고하십시오.

**배포 환경을 밖에서 직접 찔러보는 방법**: 서버 액션은 공개 청크에 액션 ID가 들어 있어
`curl`로 직접 호출할 수 있습니다. 배포 반영 여부와 인증 동작을 확인할 때 유용합니다.

```bash
curl -s "$BASE/teacher/rubrics/new" | grep -oE '/_next/static/chunks/app/teacher/rubrics/new/[^"]*\.js'
# 그 청크에서 createServerReference("<액션ID>",...,"<함수명>") 를 찾은 뒤
curl -X POST "$BASE/teacher/rubrics/new" -H "Next-Action: <액션ID>" \
     -H "Content-Type: text/plain;charset=UTF-8" --data-binary '[...]'
```

로그인이 필요한 액션은 서비스 계정으로 세션을 만들어 쓸 수 있습니다(비밀번호 불필요).
Admin SDK로 커스텀 토큰 발급 → REST로 ID 토큰 교환 → `/api/session`으로 쿠키 발급.
`scripts/experiments/verify-action-guards.ts`, `sweep-action-guards.ts` 가 그렇게 되어 있습니다.

**환경 변수를 바꿨는데 반영되지 않을 때**: Redeploy 시 빌드 캐시를 재사용하면 새 값이
들어가지 않는 경우가 있었습니다. "Use existing Build Cache" 체크를 해제하거나
아무 커밋이나 하나 푸시하십시오. 반영 여부는 응답의 Next.js 빌드 ID가 바뀌었는지로
가늠할 수 있습니다.

### 루브릭 채점 — 검증 완료 (2026-08-11)

응시·대화·재시도·전체재채점 네 경로를 실제로 실행해 확인했습니다.
학생 음성은 프로젝트 TTS로 만들어 전사 단계까지 실제로 태웠습니다.

- 교사가 만든 항목 이름·배점이 그대로 채점에 쓰입니다 (누락·병합·창작 없음).
- 배점이 불균등한 루브릭(10/10/30/30/20)도 항목별 만점이 그대로 유지됩니다.
- 변별력 확인: 같은 루브릭에서 충실한 답변 24/25, 빈약한 답변 11/25.
- 발음 점수는 발음 항목이 있으면 그 항목만 환산해 씁니다(총점 환산값과 다른 값이 나옴을 확인).
  발음 항목이 없는 루브릭은 총점 환산값으로 대체됩니다.

검증 스크립트는 `scripts/experiments/e2e-rubric-grading.ts`,
`scripts/experiments/e2e-rubric-other-paths.ts` 입니다(gitignore 대상이라 저장소에는 없습니다).
테스트 문서는 실행 끝에 스스로 지웁니다.

**주의**: 실제 데이터의 평가 8건 중 `loadedRubricId`가 설정된 것은 아직 하나도 없습니다.
`useRubric=true`인 3건도 이 기능보다 먼저 만들어져 루브릭 ID가 비어 있어 일반 채점으로 갑니다.
루브릭으로 채점하려면 평가를 수정해 루브릭을 다시 골라야 합니다.

### 이 과정에서 찾은 버그 (고침, `932fec9`)

**녹음 업로드가 항상 실패하고 있었습니다.**

학생 응시 화면은 `MediaRecorder`를 `audio/webm;codecs=opus`로 쓰므로 브라우저가 만드는 값은
`data:audio/webm;codecs=opus;base64,...` 입니다. `uploadDataUrl`의 정규식이 MIME 파라미터를
고려하지 않아 이 형식을 전부 거부했습니다. 지난 세션에 클라이언트 SDK `uploadString`을
Admin SDK로 옮기면서 들어온 문제입니다 (`uploadString`은 이 형식을 그대로 받았습니다).

게다가 업로드는 전사와 나란히 돌리려고 즉시 `await` 하지 않는데, 그 사이에 거절되면
**처리자 없는 rejection이 되어 플로우의 catch가 아니라 프로세스가 죽습니다.**
결과 문서는 '오류'로도 넘어가지 못하고 '분석 중: upload'에 멈춥니다.
`'use server'` 파일에서 상수를 export하는 것과 비슷하게, 증상만 봐서는 원인을 찾기 어렵습니다.
**즉시 await 하지 않는 Promise에는 반드시 핸들러를 붙여 두십시오.**

### 정리 대상

- ~~**`workspace/` 폴더**~~ — 2026-08-12 삭제 완료. 사본 3개를 원본과 대조해 남길 내용이
  없음을 확인했습니다(자세한 내용은 OPERATION_GUIDE 6장). 타입 에러 42 → 36건.
  `.env.local`은 루트의 `.env.workspace-old.local`로 옮겨 두었습니다. 그 안의
  **OpenAI 키가 루트 `.env`와 다릅니다.** 계정에서 살아 있다면 폐기하고 백업도 지우십시오.
- **`ALL_CODE.md`, `all_code*.md`** — 코드 스냅샷 4개(약 350KB). 의도적 기록인지 확인 후 판단.
- **미사용 shadcn 프리미티브 4개** (`carousel`, `collapsible`, `menubar`, `slider`)

### 알아두어야 할 제약

- ~~`GOOGLE_GENAI_API_KEY` 교체~~ — 2026-08-12 교체 완료. 프로덕션 키 지문이
  `9e129e79` → `21262687` 로 바뀐 것을 확인했습니다(SHA-256 앞 8자리).
  **로컬 `.env`는 아직 옛 키입니다.** 옛 키를 폐기하면 로컬 개발과 검증 스크립트가
  전부 실패하므로 함께 바꾸십시오 (`GOOGLE_GENAI_API_KEY`, `GEMINI_API_KEY` 둘 다).
- **실시간 대화(Gemini) 도구는 여전히 브라우저에 키를 내려보냅니다.**
  `?key=` 로 WebSocket URL에 붙습니다. 임시 토큰(`auth_tokens`)으로 바꾸려 했으나
  **발급은 되는데 접속이 거부됩니다** — `access_token`(v1alpha·v1beta), `Authorization: Token`,
  미인코딩까지 4가지를 시도했고 전부 `unregistered callers`로 닫혔습니다.
  같은 조건에서 원본 키는 성공하므로 설정 문제가 아니라 아직 지원되지 않는 것으로 보입니다.
  지금은 로그인한 사용자만 받을 수 있게 막아 둔 상태입니다.
- **`gradeWithRubric`은 평가의 `evaluationModel`을 무시하고 항상 `googleai/gemini-3.6-flash`로 갑니다.**
  같은 플로우의 전사·지도 조언은 교사가 고른 모델을 쓰는데 채점만 다릅니다. 의도인지 확인이 필요합니다.
- `claude-sonnet-5`는 구조화 출력이 불안정합니다(4회 중 2회, 데이터 대신 JSON 스키마를 그대로 반환).
  루브릭 파일 분석에서는 문제가 없었지만 채점에 쓰려면 주의가 필요합니다.
- **평가 목록의 gpt-5.6 3종은 내용 채점만 합니다.** 전사와 발음 점수는 Gemini가 매깁니다.
  발음 채점 모델을 비교하는 용도로는 쓸 수 없습니다.
- 교사 이름은 로그인 아이디라 프로필 화면에서 바꿀 수 없습니다.
- 과거 결과 20건 중 3건이 전 항목 0점입니다(옛 파싱 버그). **재채점은 하지 않아도 됩니다.**
  확인해 보니 셋 다 테스트 학생(일학생·이학생)의 것이고 부모 평가 문서가 이미 지워져 있습니다.
  재채점 경로 두 가지(`retryAnalysis`, `rerunAllAnalyses`) 모두 평가 문서를 읽으므로 애초에 불가능합니다.
- `retryAnalysis`는 결과 상태가 `'오류'`일 때만 동작합니다. 이미 '채점 완료'인 결과를 다시
  채점하려면 평가 화면의 전체 재채점(`rerunAllAnalyses`)을 쓰십시오.
- 랜딩 페이지 데모 계정 메뉴는 교사 비밀번호로 잠겨 있고, 로그인 상태면 유지됩니다.

### 개발 시 주의

- 로컬에서 `npx next start` 후 코드를 고쳐 다시 빌드하면 **이전 프로세스가 포트를 잡고 옛 빌드를 계속 서빙합니다.**
  `pkill`로 안 죽습니다. PowerShell에서 포트 기준으로 종료하십시오.
  ```powershell
  Get-NetTCPConnection -LocalPort 3122 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
  ```
- 커밋 메시지에 아포스트로피(`'`)가 있으면 bash 홑따옴표 heredoc이 깨집니다. `git commit -F -` 사용.

---

## 5. 검증 방식에 대한 메모

이 세션에서 **추측으로 고쳤다가 두 번 틀렸습니다.** 이후로는 다음을 지켰습니다.

- 모델·API 동작은 **실제로 호출해서** 확인 (더미 오디오·이미지·PDF 사용)
- 화면 동작은 **프로덕션 빌드를 띄우고 브라우저로** 확인
- 데이터는 **Admin SDK로 직접 조회**해서 확인
- 실패 재현이 안 되면 그렇다고 말하고, 고쳤다고 하지 않음

`scripts/experiments/`는 gitignore 대상이라 자유롭게 검증 스크립트를 두고 지우면 됩니다.
