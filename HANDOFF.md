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

## 3. 지금 상태

| 항목 | 상태 |
|---|---|
| 빌드 | 통과 |
| 타입 에러 | 42건 (그중 6건은 `workspace/` 사본) |
| 작업 트리 | 깨끗함, 모두 푸시됨 |
| 최신 커밋 | `6277159` |

---

## 4. 남은 일

### 배포 후 실제 확인이 필요한 것

코드와 플로우는 검증했지만 **브라우저에서 마이크가 차단되어** 끝까지 못 본 것들입니다.

1. **실시간 대화 발음 평가** — 대화 후 발음 카드가 뜨는지, 점수가 합리적인지
2. **AI 음성 재생** — `<audio>` 엘리먼트 수정 후 실제로 들리는지
3. ~~**루브릭 채점 전 과정**~~ — 2026-08-11 서버 쪽 전 경로 검증 완료. 아래 참조.
4. **녹음 보관** — 대화 후 Storage 업로드와 보관 링크
   (monologue 업로드는 아래 버그를 고치고 실제로 확인했습니다. 실시간 대화 도구 쪽은 미확인)

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

- **`workspace/` 폴더** — `src/` 파일 3개의 오래된 사본. 타입 에러 6건의 원인.
  삭제 또는 `tsconfig.json`의 `exclude` 추가. 자세한 내용은 OPERATION_GUIDE 6장.
- **`ALL_CODE.md`, `all_code*.md`** — 코드 스냅샷 4개(약 350KB). 의도적 기록인지 확인 후 판단.
- **미사용 shadcn 프리미티브 4개** (`carousel`, `collapsible`, `menubar`, `slider`)

### 알아두어야 할 제약

- **`ANTHROPIC_API_KEY`가 Vercel에 없습니다.** Claude 모델 선택 시 실패합니다.
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
