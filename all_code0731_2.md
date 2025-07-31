# SpeakSmart AI 평가도구 전체 코드 백업 (0731_2)

이 파일은 프로젝트의 모든 주요 소스 코드와 설정 파일을 포함하고 있습니다.
각 파일의 경로는 `--- FILE: [경로] ---` 형식으로 구분되어 있습니다.

--- FILE: .env ---
```

```

--- FILE: .vscode/settings.json ---
```json
{
    "IDX.aI.enableInlineCompletion": true,
    "IDX.aI.enableCodebaseIndexing": true
}
```

--- FILE: README.md ---
```md
# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

```

--- FILE: TECHNICAL_OVERVIEW.md ---
```md

# SpeakSmart AI 평가도구: 기술 개요 및 개발 가이드

이 문서는 SpeakSmart AI 기반 영어 말하기 평가 애플리케이션의 기술적 구조, 핵심 기능의 운영 방식, 그리고 개발 과정에서 마주한 주요 문제와 해결 방안을 정리한 기술 보고서입니다. 이 문서는 유사한 AI 기반 교육용 애플리케이션을 개발하려는 개발자들을 위한 가이드 역할을 합니다.

## 1. 애플리케이션 개요 및 기술 스택

SpeakSmart는 AI를 활용하여 학생들의 영어 말하기 능력을 평가하고, 개인화된 피드백을 제공하는 플랫폼입니다. 학생들은 '혼자 말하기(Monologue)' 또는 'AI와 대화하기(Dialogue)' 두 가지 유형의 평가에 참여할 수 있으며, 교사는 평가를 생성하고 학생들의 결과를 관리합니다.

### 주요 기술 스택

- **프레임워크:** Next.js (App Router), React
- **UI:** ShadCN UI, Tailwind CSS, Lucide Icons (아이콘), Recharts (차트)
- **상태 관리:** React Context API
- **백엔드 및 데이터베이스:** Firebase (Firestore, Storage, Auth)
- **AI:** Google AI (Gemini 모델)
- **AI 연동:** Genkit (Google의 생성형 AI 앱 개발 프레임워크)

---

## 2. 프로젝트 구조

프로젝트는 기능별로 명확하게 분리된 모듈식 구조를 따릅니다.

- **`src/app/`**: Next.js의 App Router 기반 라우팅 및 페이지 컴포넌트가 위치합니다. `(student)`와 `(teacher)` 경로 그룹으로 사용자 역할을 분리합니다.
- **`src/ai/flows/`**: 모든 Genkit 기반 AI 흐름(Flow)이 정의된 핵심 폴더입니다. 각 파일은 특정 AI 작업(예: 텍스트 변환, 내용 분석, 대화 생성)을 수행하는 독립적인 모듈입니다.
- **`src/components/`**: UI 컴포넌트 폴더입니다.
  - `ui/`: ShadCN을 통해 설치된 재사용 가능한 기본 UI 컴포넌트(Button, Card 등)가 있습니다.
  - `app-layout.tsx`, `icons.tsx`: 애플리케이션의 전체 레이아웃과 커스텀 아이콘을 정의합니다.
- **`src/lib/`**: 애플리케이션 전반에서 사용되는 유틸리티 및 설정 파일이 위치합니다.
  - `firebase.ts`: Firebase 클라이언트 SDK를 초기화하고 `db`, `auth`, `storage` 인스턴스를 export 합니다.
  - `types.ts`, `types/ai-schemas.ts`: TypeScript 타입 정의 및 Zod 스키마가 위치하여 데이터 구조의 일관성을 유지합니다.
  - `locales.ts`: 다국어 지원을 위한 텍스트 리소스를 관리합니다.
- **`src/context/`**: React Context API를 사용한 전역 상태 관리 로직이 위치합니다.
  - `auth-context.tsx`: 사용자 인증 상태(목업 사용자)를 관리합니다.
  - `language-context.tsx`: 다국어 상태를 관리합니다.

---

## 3. 핵심 기능 운영 방식

### 3.1. 혼자 말하기 (Monologue) 평가 흐름

1.  **평가 시작 (Assessment View):**
    - 사용자가 `[녹음 시작]` 버튼을 클릭합니다.
    - 기술적 지연을 고려해, `MediaRecorder`는 즉시 녹음을 시작합니다(`startActualRecording`).
    - 동시에 UI에는 사용자에게 준비 시간을 주기 위해 **3, 2, 1 카운트다운**을 표시합니다.
2.  **녹음 및 제출:**
    - 사용자가 답변을 마치고 `[녹음 중지]` 버튼을 누르면 녹음이 종료되고, 오디오 데이터는 Blob 형태로 클라이언트에 저장됩니다.
    - `[답변 제출하기]`를 클릭하면, 녹음된 오디오 데이터(Data URI)와 평가 메타데이터가 `sessionStorage`에 저장된 후, 결과 페이지(`/results`)로 리디렉션됩니다.
3.  **AI 분석 (Results Page):**
    - 결과 페이지는 `sessionStorage`에서 녹음 데이터를 가져와 AI 분석 프로세스를 시작합니다.
    - **`processMonologueSubmission`** 함수가 전체 과정을 오케스트레이션합니다.
    - **UI 피드백:** 사용자에게 분석이 진행 중임을 알리는 단계별 UI(`AnalysisProgressView`)가 표시됩니다. (파일 업로드 → 텍스트 변환 → 내용/발음 분석 → 리포트 생성)
    - **병렬 처리:** `generateMonologueAnalysisFlow` 흐름이 호출됩니다. 이 흐름 내부에서는 다음과 같은 작업이 병렬로 실행되어 효율성을 높입니다.
      - **음성-텍스트 변환(STT):** `gemini-2.0-flash` 모델이 오디오를 텍스트로 변환합니다.
      - **내용 분석:** STT 결과를 바탕으로 `gemini-2.0-flash` 모델이 내용, 문법, 어휘를 평가합니다.
      - **발음 분석:** 원본 오디오와 STT 결과를 비교하여 `gemini-2.0-flash` 모델이 발음을 평가합니다.
4.  **결과 저장 및 표시:**
    - 모든 분석 결과가 취합되어 Firestore `results` 컬렉션에 저장됩니다.
    - 동시에 `assessments` 컬렉션의 제출 횟수와 평균 점수가 업데이트됩니다.
    - Firestore의 `onSnapshot` 리스너가 데이터 변경을 감지하고, 상태가 '채점 완료'로 변경되면 UI가 최종 피드백 화면(`FeedbackView`)으로 자동 전환됩니다.

### 3.2. AI와 대화하기 (Dialogue) 평가 흐름

1.  **대화 시작 (FreeTalkView):**
    - 사용자가 `[대화 시작]` 버튼을 누르면, `converseWithStudentFlow`가 호출되어 AI의 첫인사 음성/텍스트를 받아옵니다.
    - AI의 음성이 끝나면 UI는 "응답하기" 상태로 전환됩니다.
2.  **턴(Turn) 기반 상호작용:**
    - 사용자가 `[응답하기]` 버튼을 누르고 말한 뒤, `[말하기 중지]`를 누릅니다.
    - 녹음된 오디오는 `converseWithStudentFlow`로 전송됩니다. 이 흐름은 다음 작업을 수행합니다.
      - **STT:** `gemini-2.5-flash` 모델이 사용자 음성을 텍스트로 변환합니다.
      - **AI 응답 생성:** 이전 대화 내용과 사용자 발화 내용을 바탕으로 `gemini-2.5-flash` 모델이 다음 대화 텍스트를 생성합니다.
      - **TTS:** 생성된 텍스트를 `gemini-2.5-flash-preview-tts` 모델이 음성으로 변환하여 반환합니다.
    - 클라이언트는 AI의 음성을 재생하고, 대화 기록을 UI에 업데이트합니다. 이 과정이 반복됩니다.
3.  **대화 종료 및 분석:**
    - 사용자가 `[대화 종료]` 버튼을 클릭하면, 모든 대화 기록과 녹음 파일(Blob 결합)이 `sessionStorage`에 저장되고 결과 페이지로 이동합니다.
    - **`FreeTalkFeedbackView`** 컴포넌트가 `sessionStorage` 데이터를 기반으로 분석을 시작합니다.
    - **UI 피드백:** Monologue와 마찬가지로 단계별 분석 진행 UI가 표시됩니다.
    - **AI 분석:** `generateDialogueAnalysisFlow`가 호출되어 **내용 분석**과 **발음 분석**을 `gemini-2.5-flash` 모델로 병렬 처리합니다.
4.  **결과 저장 및 표시:**
    - 분석 결과가 Firestore에 저장되고, UI는 최종 피드백 화면으로 전환됩니다.

---

## 4. 주요 기술적 과제 및 해결 방안

### 4.1. 문제: AI 모델 과부하 (503 Service Unavailable)
- **현상:** 개발 초기, `gemini-2.0-flash` 모델에 대한 요청이 많아지자 API가 `503 Service Unavailable` 오류를 반환하며 AI 분석이 실패하는 경우가 빈번했습니다.
- **원인:** 특정 모델에 일시적으로 요청이 몰려 발생하는 서버 측 과부하 문제입니다.
- **해결 방안:**
  - **모델 교체:** 문제가 발생한 AI 흐름(Dialogue 분석, 실시간 대화 생성 등)에서 사용하던 모델을 `gemini-2.0-flash`에서 더 안정적이고 성능이 우수한 **`gemini-2.5-flash`**로 변경했습니다.
  - **모델 분산:** '기타 도구'의 발음/텍스트 변환기처럼, 여러 모델(`gemini-2.5-flash`, `gemini-2.5-flash-lite-preview-06-17`, `gemini-2.0-flash`)의 결과를 동시에 비교하여 보여주는 기능을 구현했습니다. 이는 특정 모델의 장애에 대한 의존도를 낮추고, 모델별 성능을 비교하는 데 도움을 줍니다.

### 4.2. 문제: 초기 녹음 데이터 손실
- **현상:** 사용자가 `[녹음 시작]` 버튼을 누르자마자 말을 시작하면, 음성의 첫 0.5~1초가 녹음되지 않는 문제가 발생했습니다.
- **원인:** 브라우저에서 `navigator.mediaDevices.getUserMedia()`를 호출하고 `MediaRecorder`가 실제로 오디오 스트림 수집을 시작하기까지 약간의 기술적 지연(latency)이 발생하기 때문입니다.
- **해결 방안:**
  - **UI/UX 개선을 통한 문제 해결:** 기술적 지연 자체를 없애는 대신, 사용자 경험을 개선하여 문제를 우회했습니다.
  - **'혼자 말하기' 평가:**
    1.  `[녹음 시작]` 버튼 클릭 시, **실제 녹음 로직(`MediaRecorder.start()`)은 즉시 실행**합니다.
    2.  동시에, UI에는 **3, 2, 1 카운트다운**을 표시하여 사용자가 바로 말하지 않도록 유도합니다.
    3.  이를 통해 기술적 지연 시간 동안 사용자는 카운트다운을 보며 기다리게 되고, 녹음 준비가 완료된 최적의 타이밍에 말을 시작하게 되어 음성 앞부분이 잘리는 문제를 해결했습니다.
  - **'AI와 대화하기' 평가:**
    - 매 턴마다 카운트다운을 넣는 것은 부자연스러우므로, 대신 "응답하기 버튼을 누른 후 약 1-2초 뒤에 말씀하시면 더 정확하게 인식됩니다."와 같은 **안내 문구를 UI에 명확히 표시**하여 사용자의 행동을 유도했습니다.
  - **즉각적인 데이터 수집:** `mediaRecorderRef.current.start(100)`과 같이 `timeslice` 옵션을 주어, 녹음된 데이터를 작은 조각(chunk)으로 자주 받아오도록 설정하여 초기 데이터 손실 가능성을 최소화했습니다.

### 4.3. 문제: 서버 환경에서의 Firebase Admin SDK 초기화 오류
- **현상:** Genkit 흐름은 서버 환경에서 실행되지만, Firebase Admin SDK 초기화 시 간헐적인 인증 및 권한 오류가 발생했습니다.
- **원인:** 배포 환경의 서비스 계정 설정 또는 환경 변수 로딩 시점 문제로 추정됩니다.
- **해결 방안:**
  - **클라이언트 측 처리로 전환:** 서버 측의 불안정성을 회피하기 위해, **모든 Firestore 및 Storage 관련 작업을 클라이언트 측으로 이전**했습니다.
  - **데이터 전달 방식 변경:** 클라이언트(React 컴포넌트)가 녹음 데이터(Data URI)를 `sessionStorage`에 저장한 후, 결과 페이지로 이동합니다. 결과 페이지 컴포넌트가 `sessionStorage`에서 데이터를 읽어 AI 흐름 함수를 직접 호출하고, 반환된 결과를 받아 Firestore에 저장하는 방식으로 아키텍처를 변경했습니다.
  - **장점:** 이 방식은 서버 환경의 복잡성을 줄이고, 클라이언트의 인증 상태를 그대로 활용할 수 있어 구현이 더 간단하고 안정적입니다.
  - **단점:** 민감한 데이터를 처리할 경우 보안에 유의해야 하지만, 현재 애플리케이션의 데이터 특성상 허용 가능한 수준의 설계입니다.
```

--- FILE: apphosting.yaml ---
```yaml
# Settings to manage and configure a Firebase App Hosting backend.
# https://firebase.google.com/docs/app-hosting/configure

runConfig:
  # Increase this value if you'd like to automatically spin up
  # more instances in response to increased traffic.
  maxInstances: 1

```

--- FILE: components.json ---
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

--- FILE: cors.json ---
```json
[
  {
    "origin": [
      "http://localhost:3000",
      "http://localhost:9002",
      "https://speaksmart-evaluator.web.app",
      "https://speaksmart-evaluator.firebaseapp.com"
    ],
    "method": [
      "GET",
      "POST",
      "PUT",
      "HEAD"
    ],
    "responseHeader": [
      "Content-Type",
      "Access-Control-Allow-Origin"
    ],
    "maxAgeSeconds": 3600
  }
]
```

--- FILE: firebase.json ---
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "out",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

--- FILE: firestore.indexes.json ---
```json
{
  "indexes": [
    {
      "collectionGroup": "assessments",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "uid",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "results",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "studentId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "assessmentId",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "results",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "assessmentId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "results",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "studentId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "results",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "assessmentId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "studentId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "results",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "assessmentId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "studentId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "ASCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

--- FILE: next.config.ts ---
```ts
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      }
    ],
  },
};

export default nextConfig;
```

--- FILE: package.json ---
```json
{
  "name": "nextn",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack -p 9002",
    "genkit:dev": "genkit start -- tsx src/ai/dev.ts",
    "genkit:watch": "genkit start -- tsx --watch src/ai/dev.ts",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@genkit-ai/googleai": "^1.13.0",
    "@genkit-ai/next": "^1.13.0",
    "@hookform/resolvers": "^4.1.3",
    "@radix-ui/react-accordion": "^1.2.3",
    "@radix-ui/react-alert-dialog": "^1.1.6",
    "@radix-ui/react-avatar": "^1.1.3",
    "@radix-ui/react-checkbox": "^1.1.4",
    "@radix-ui/react-collapsible": "^1.1.11",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-label": "^2.1.2",
    "@radix-ui/react-menubar": "^1.1.6",
    "@radix-ui/react-popover": "^1.1.6",
    "@radix-ui/react-progress": "^1.1.2",
    "@radix-ui/react-radio-group": "^1.2.3",
    "@radix-ui/react-scroll-area": "^1.2.3",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-separator": "^1.1.2",
    "@radix-ui/react-slider": "^1.2.3",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-switch": "^1.1.3",
    "@radix-ui/react-tabs": "^1.1.3",
    "@radix-ui/react-toast": "^1.2.6",
    "@radix-ui/react-toggle-group": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.8",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.0.0",
    "date-fns": "^3.6.0",
    "dotenv": "^16.4.5",
    "embla-carousel-react": "^8.6.0",
    "firebase": "^10.12.2",
    "firebase-admin": "^12.1.1",
    "genkit": "^1.13.0",
    "lucide-react": "^0.475.0",
    "next": "15.3.3",
    "patch-package": "^8.0.0",
    "react": "^18.3.1",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.54.2",
    "react-markdown": "^9.0.1",
    "recharts": "^2.15.1",
    "remark-gfm": "^4.0.0",
    "tailwind-merge": "^3.0.1",
    "tailwindcss-animate": "^1.0.7",
    "uuid": "^9.0.1",
    "wav": "^1.0.2",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@types/uuid": "^9.0.8",
    "@types/wav": "^1.0.4",
    "genkit-cli": "^1.13.0",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
```

--- FILE: storage.rules ---
```
rules_version = '2';

// 1. Allow public read access to all files.
// 2. Allow write access only to authenticated users.
// 3. Ensure the uploaded file is not excessively large (e.g., max 10MB).
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read;
      allow write: if request.auth != null && request.resource.size < 10 * 1024 * 1024;
    }
  }
}
```

--- FILE: tailwind.config.ts ---
```ts
import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-noto-sans-kr)', 'sans-serif'],
        headline: ['var(--font-noto-sans-kr)', 'sans-serif'],
        code: ['monospace'],
      },
      colors: {
        'jeju-sea': '#4A90E2',
        'basalt-gray': '#555555',
        'tangerine': '#F5A623',
        'bijarim-green': '#2E8B57',
        'saebyeol-beige': '#F8F5F2',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
         'ping-short': {
          '0%': {
            transform: 'scale(1)',
            opacity: '1',
          },
          '50%': {
            transform: 'scale(1.5)',
            opacity: '0.3',
          },
          '100%': {
            transform: 'scale(1)',
            opacity: '1',
          },
        },
        'glow-once': {
          '0%': {
            boxShadow: '0 0 0 0 hsl(var(--primary) / 0.4)',
          },
          '50%': {
            boxShadow: '0 0 10px 3px hsl(var(--primary) / 0.4)',
          },
          '100%': {
            boxShadow: '0 0 0 0 hsl(var(--primary) / 0)',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'ping-short': 'ping-short 1s cubic-bezier(0, 0, 0.2, 1) infinite',
        'glow-once': 'glow-once 1s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
```

--- FILE: tsconfig.json ---
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

--- FILE: src/ai/dev.ts ---
```ts
import { config } from 'dotenv';
config();

// The following flows are now integrated into the new analysis flow
// and no longer need to be individually registered for direct client use.
// import '@/ai/flows/generate-content-feedback.ts';
// import '@/ai/flows/generate-pronunciation-feedback.ts';

// These flows are still used independently.
import '@/ai/flows/draft-curricular-remarks.ts';
import '@/ai/flows/summarize-student-feedback.ts';
import '@/ai/flows/text-to-speech.ts';
import '@/ai/flows/transcribe-file.ts';
import '@/ai/flows/analyze-pronunciation.ts'; // New flow for the main page tool
import '@/ai/flows/generate-image-flow.ts'; // For assessment creation

// New, separated flows for monologue and dialogue analysis
import '@/ai/flows/generate-monologue-analysis-flow';
import '@/ai/flows/generate-dialogue-analysis-flow';

// New flow for the Misc page's real-time conversation tool
import '@/ai/flows/create-native-teacher-flow';
import '@/ai/flows/create-concurrent-teacher-flow'; // New flow for concurrent recording tool
import '@/ai/flows/create-parallel-teacher-flow'; // New flow for parallel processing tool
import '@/ai/flows/create-hybrid-teacher-flow'; // New flow for hybrid VAD tool
import '@/ai/flows/create-speculative-teacher-flow'; // New flow for speculative speech model

// New flow for the Misc page's read-aloud tool
import '@/ai/flows/analyze-read-aloud-flow';
import '@/ai/flows/enhance-selected-text-flow'; // New flow for Read Aloud Tool 2.0
import '@/ai/flows/extract-text-from-file.ts'; // New flow for file upload text extraction

// New flow for the Misc page's handwriting analysis tool
import '@/ai/flows/analyze-handwriting-flow';

// New flow for growth analysis
import '@/ai/flows/generate-growth-feedback-flow';

// New flow for retrying analysis
import '@/ai/flows/retry-analysis-flow';

// New flow for presentation analysis
import '@/ai/flows/analyze-presentation-video-flow';

// This flow is being removed due to errors.
// import '@/ai/flows/regenerate-html-feedback-flow';
```

--- FILE: src/ai/flows/analyze-handwriting-flow.ts ---
```ts
'use server';

/**
 * @fileOverview A flow to analyze a user's handwriting from an image.
 * It provides a transcript, word-by-word analysis, and overall feedback.
 * 
 * - analyzeHandwriting - A function that takes an image data URI and returns detailed analysis.
 * - AnalyzeHandwritingInput - The input type for the flow.
 * - AnalyzeHandwritingOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const AnalyzeHandwritingInputSchema = z.object({
  imageDataUri: z.string().describe(
    "An image file of the user's handwriting, as a data URI."
  ),
});
export type AnalyzeHandwritingInput = z.infer<typeof AnalyzeHandwritingInputSchema>;

const WordAnalysisSchema = z.object({
    word: z.string().describe("The transcribed word."),
    status: z.enum(['clear', 'needs_improvement']).describe("The legibility status of the word: 'clear' if easily readable, 'needs_improvement' if difficult to read."),
    feedback: z.string().optional().describe("Specific feedback on why the word needs improvement (e.g., 'The letter 'e' looks like 'o'')."),
});

const AnalyzeHandwritingOutputSchema = z.object({
  transcript: z.string().describe('The full transcript of what the AI could read from the image.'),
  overallFeedback: z.string().describe('Holistic feedback on the handwriting, covering aspects like spacing, consistency, and size, in Korean.'),
  wordAnalysis: z.array(WordAnalysisSchema).describe("A word-by-word analysis of the handwriting's legibility."),
});
export type AnalyzeHandwritingOutput = z.infer<typeof AnalyzeHandwritingOutputSchema>;


export async function analyzeHandwriting(input: AnalyzeHandwritingInput): Promise<AnalyzeHandwritingOutput> {
  const result = await analyzeHandwritingFlow(input);
  return result;
}

const handwritingAnalysisPrompt = ai.definePrompt({
    name: 'handwritingAnalysisPrompt',
    model: googleAI.model('gemini-2.5-flash'),
    input: { schema: AnalyzeHandwritingInputSchema },
    output: { schema: AnalyzeHandwritingOutputSchema },
    prompt: `You are an expert handwriting analyst and teacher, specializing in providing feedback for English language learners. Your task is to evaluate a student's handwriting from an image. Provide all feedback in Korean.

Here is the data for analysis:
- Student's Handwritten Text (Image): 
{{media url=imageDataUri}}

Please perform the following steps:
1.  **Transcribe the Text:** Read the handwritten text in the image and convert it into a single string for the 'transcript'. If you cannot read any text, the transcript should be empty.
2.  **Perform Word-by-Word Analysis:** Go through the transcribed text word by word. For each word, create an object for the 'wordAnalysis' array.
    - 'word': The word you transcribed.
    - 'status': Set to 'clear' if the word is perfectly legible and well-formed. Set to 'needs_improvement' if any letter is unclear, misshapen, or ambiguous.
    - 'feedback': If the status is 'needs_improvement', provide a short, specific reason in Korean (e.g., "'a'와 'o'의 구분이 모호함", "'l'의 높이가 너무 낮음").
3.  **Provide Overall Feedback:** Write holistic, constructive feedback in Korean for the 'overallFeedback' field. Comment on the general legibility, spacing between words, consistency of letter size, and slant. Offer actionable advice for improvement.
4.  **Format the Output:** Return the full transcript, the word-by-word analysis array, and the overall feedback in the specified JSON format. If no text is detected, return an empty transcript, empty array, and feedback indicating no text was found.
`,
});

const analyzeHandwritingFlow = ai.defineFlow(
  {
    name: 'analyzeHandwritingFlow',
    inputSchema: AnalyzeHandwritingInputSchema,
    outputSchema: AnalyzeHandwritingOutputSchema,
  },
  async (input) => {
    const { output } = await handwritingAnalysisPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid handwriting analysis.");
    }
    return output;
  }
);
```

--- FILE: src/ai/flows/analyze-presentation-video-flow.ts ---
```ts
'use server';
/**
 * @fileOverview A flow to analyze a student's presentation video.
 * It evaluates content, language competence, and delivery based on the video and optional supplementary materials.
 * 
 * - analyzePresentationVideo - A function that takes a video and other data, returning a detailed analysis.
 * - AnalyzePresentationVideoInput - The input type for the flow.
 * - AnalyzePresentationVideoOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const FeedbackSchema = z.object({
    score: z.number().int().min(0).max(100).describe("The score for this category, from 0 to 100."),
    feedback: z.string().describe("Specific, constructive feedback for this category in Korean, including examples from the presentation."),
});

const AnalyzePresentationVideoInputSchema = z.object({
  videoDataUri: z.string().describe(
    "A video file of the student's presentation, as a data URI."
  ),
  presentationFileUri: z.string().optional().describe(
    "An optional presentation file (e.g., PDF, PPTX) as a data URI."
  ),
  customCriteria: z.string().optional().describe(
    "Optional custom evaluation criteria provided by the teacher."
  ),
});
export type AnalyzePresentationVideoInput = z.infer<typeof AnalyzePresentationVideoInputSchema>;

const AnalyzePresentationVideoOutputSchema = z.object({
  overallScore: z.number().int().min(0).max(100).describe("The final, weighted overall score for the presentation."),
  content: FeedbackSchema.describe("Evaluation of the presentation's content."),
  languageCompetence: FeedbackSchema.describe("Evaluation of the student's language competence."),
  delivery: FeedbackSchema.describe("Evaluation of the student's delivery and attitude."),
  overallFeedback: z.string().describe("A summary of the overall performance and final constructive advice in Korean."),
});
export type AnalyzePresentationVideoOutput = z.infer<typeof AnalyzePresentationVideoOutputSchema>;


export async function analyzePresentationVideo(input: AnalyzePresentationVideoInput): Promise<AnalyzePresentationVideoOutput> {
  const result = await analyzePresentationVideoFlow(input);
  return result;
}

const presentationAnalysisPrompt = ai.definePrompt({
    name: 'presentationAnalysisPrompt',
    model: googleAI.model('gemini-2.5-pro'),
    input: { schema: AnalyzePresentationVideoInputSchema },
    output: { schema: AnalyzePresentationVideoOutputSchema },
    prompt: `You are an expert AI teacher evaluating a student's English presentation or conversation performance. Your task is to provide a comprehensive, multi-faceted evaluation based on a video, optional presentation materials, and specific criteria. All feedback must be in Korean.

### Provided Materials for Evaluation:
1.  **Student's Presentation Video:**
    {{media url=videoDataUri}}

{{#if presentationFileUri}}
2.  **Student's Presentation Document (PDF/PPTX):**
    {{media url=presentationFileUri}}
{{/if}}

### Core Evaluation Framework:
You must evaluate the student's performance across three main categories: **Content, Language Competence, and Delivery**. Use the detailed criteria below for each category.

---

#### 1. 내용 (Content): 충실성 및 논리성
-   **주제 적합성 및 이해도:** 제시된 주제나 상황을 정확하게 이해하고 있는가?
-   **내용의 충실성 및 완성도:** 전달하고자 하는 내용이 풍부하고 짜임새 있게 구성되었는가?
-   **논리적 구성:** 서론, 본론, 결론의 구조가 명확하며, 내용의 흐름이 자연스럽고 논리적인가?
-   **창의성:** 자신만의 생각이나 아이디어를 독창적으로 표현했는가? (가산점 요소)

#### 2. 언어적 능력 (Language Competence): 정확성 및 유창성
-   **정확성 (Accuracy):**
    -   **문법 (Grammar):** 문법적 오류 없이 정확한 문장을 구사하는가?
    -   **어휘 (Vocabulary):** 주제와 상황에 맞는 적절하고 다양한 어휘를 사용하는가?
-   **유창성 (Fluency):**
    -   **발음 및 억양 (Pronunciation & Intonation):** 명확한 발음과 자연스러운 억양을 구사하는가?
    -   **속도 및 망설임 (Speed & Hesitation):** 너무 빠르거나 느리지 않고, 불필요한 멈춤 없이 자연스럽게 말하는가?

#### 3. 발표 태도 (Delivery): 전달 효과성
-   **자신감 및 태도:** 자신감 있는 목소리와 바른 자세를 유지하는가?
-   **시선 처리 (Eye Contact):** 카메라(청중)와 적절하게 시선을 맞추며 소통하는가?
-   **목소리 크기 및 표현력:** 목소리 크기가 적절하며, 내용에 따라 톤에 변화를 주어 효과적으로 전달하는가?
-   **시간 관리:** 영상 길이를 고려했을 때, 발표 시간을 효과적으로 활용했는가?

---

{{#if customCriteria}}
### Teacher's Custom Criteria:
In addition to the core framework, pay special attention to the following criteria provided by the teacher:
"{{{customCriteria}}}"
{{/if}}

### IMPORTANT ANALYSIS INSTRUCTION:
If the video appears to be a casual conversation, a non-standard activity, or does not fit a formal presentation structure, you MUST **prioritize the teacher's custom criteria** as the main evaluation framework. In this case, adapt your analysis of Content, Language, and Delivery to reflect the custom criteria. If no custom criteria are provided for such a video, evaluate based on general conversational abilities.

### Your Task:
1.  **Analyze and Score Each Category:** Carefully review all provided materials. For each of the three main categories (Content, Language Competence, Delivery), provide a score from 0 to 100.
2.  **Write Detailed Feedback for Each Category:** For each category, write specific, constructive feedback in Korean. Justify the score you gave by providing concrete examples (what the student did well, what they did wrong) from the video and/or presentation materials.
3.  **Calculate Overall Score:** Calculate a final weighted score. The weights are: Content (40%), Language Competence (40%), Delivery (20%).
4.  **Write Overall Feedback:** Provide a holistic summary of the student's performance. Highlight their key strengths and suggest the most critical areas for improvement.
5.  **Format the Output:** Return the complete analysis in the specified JSON format.
`,
});

const analyzePresentationVideoFlow = ai.defineFlow(
  {
    name: 'analyzePresentationVideoFlow',
    inputSchema: AnalyzePresentationVideoInputSchema,
    outputSchema: AnalyzePresentationVideoOutputSchema,
  },
  async (input) => {
    const { output } = await presentationAnalysisPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid presentation analysis.");
    }
    return output;
  }
);
```

--- FILE: src/ai/flows/analyze-pronunciation.ts ---
```ts
'use server';

/**
 * @fileOverview A flow to analyze the pronunciation of a spoken English audio file using multiple models for comparison.
 *
 * - analyzePronunciation - A function that takes an audio data URI and returns pronunciation feedback from multiple models.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const PronunciationAnalysisInputSchema = z.object({
  audioDataUri: z.string().describe(
    "An audio file as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:audio/webm;codecs=opus;base64,<encoded_data>'."
  ),
});

const PronunciationAnalysisOutputSchema = z.object({
  pronunciationScore: z.number().int().min(0).max(100).describe('A score from 0-100 for pronunciation (accuracy, clarity, intonation, and fluency).'),
  pronunciationFeedback: z.string().describe('Specific, constructive feedback on the student\'s pronunciation in Korean.'),
});

const PronunciationAnalysisResultSchema = PronunciationAnalysisOutputSchema.extend({
  model: z.string().describe('The name of the model that generated this analysis.'),
});

export type PronunciationAnalysisResult = z.infer<typeof PronunciationAnalysisResultSchema>;

export async function analyzePronunciation(audioDataUri: string): Promise<PronunciationAnalysisResult[]> {
  const result = await analyzePronunciationFlow({ audioDataUri });
  return result;
}

const modelsToCompare = [
    'gemini-2.5-flash-lite-preview-06-17',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
];

const createPronunciationPrompt = (modelName: string) => {
    return ai.definePrompt({
        name: `pronunciationAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`, // Allow dots in names
        model: googleAI.model(modelName as any), // Use 'as any' to allow dynamic model names
        input: { schema: PronunciationAnalysisInputSchema },
        output: { schema: PronunciationAnalysisOutputSchema },
        prompt: `You are an expert English pronunciation coach. Your task is to evaluate a user's spoken English based on an audio recording. Provide all feedback in Korean.

- User's Audio Recording: {{media url=audioDataUri contentType='audio/webm;codecs=opus'}}

Please perform the following steps:
1.  Listen carefully to the audio.
2.  Evaluate the user's overall accuracy, clarity, intonation, and fluency.
3.  **Assign a Pronunciation Score:** Give a score from 0 to 100 (100 is native-like, 0 is unintelligible).
4.  **Provide Pronunciation Feedback:** Write specific, constructive feedback in Korean. Point out general patterns or specific words/sounds that were pronounced well and those that need improvement. If the audio is silent or contains no discernible speech, provide a score of 0 and state that no speech was detected.
`,
    });
}

const analyzePronunciationFlow = ai.defineFlow(
  {
    name: 'analyzePronunciationFlow',
    inputSchema: PronunciationAnalysisInputSchema,
    outputSchema: z.array(PronunciationAnalysisResultSchema),
  },
  async (input) => {
    
    const analysisPromises = modelsToCompare.map(async (modelName) => {
        try {
            const prompt = createPronunciationPrompt(modelName);
            const { output } = await prompt(input);
            if (!output) {
              throw new Error(`Model ${modelName} returned no output.`);
            }
            return { ...output, model: modelName };
        } catch (error: any) {
            console.error(`Error analyzing with model ${modelName}:`, error);
            // Return a specific error object for this model on failure
            return {
                model: modelName,
                pronunciationScore: 0,
                pronunciationFeedback: `[오류] 모델 분석에 실패했습니다: ${error.message}`
            }
        }
    });

    const results = await Promise.all(analysisPromises);
    
    return results;
  }
);
```

--- FILE: src/ai/flows/analyze-read-aloud-flow.ts ---
```ts
'use server';

/**
 * @fileOverview A flow to analyze a user's reading of a given text.
 * It compares the user's audio recording with the original text to provide detailed feedback.
 * 
 * - analyzeReadAloud - A function that takes an audio data URI and the original text, returning detailed analysis.
 * - AnalyzeReadAloudInput - The input type for the flow.
 * - AnalyzeReadAloudOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const AnalyzeReadAloudInputSchema = z.object({
  audioDataUri: z.string().describe(
    "An audio file of the user reading the text, as a data URI."
  ),
  originalText: z.string().describe('The text that the user was supposed to read.'),
});
export type AnalyzeReadAloudInput = z.infer<typeof AnalyzeReadAloudInputSchema>;

const WordAnalysisSchema = z.object({
    word: z.string().describe("The word from the original text."),
    status: z.enum(['correct', 'incorrect', 'omitted', 'insertion']).describe("The status of the word: 'correct' if read correctly, 'incorrect' if mispronounced or substituted, 'omitted' if skipped. 'insertion' is for words the user said that were not in the text and has no 'word' field from original text."),
    spoken: z.string().optional().describe("The actual word spoken by the user if it was incorrect."),
});


const AnalyzeReadAloudOutputSchema = z.object({
  accuracy: z.number().int().min(0).max(100).describe('A score from 0-100 representing how accurately the user read the text (word-for-word match).'),
  fluency: z.number().int().min(0).max(100).describe('A score from 0-100 for the fluency of the reading (flow, pace, and rhythm).'),
  completionRate: z.number().int().min(0).max(100).describe('The percentage of the text that the user actually read.'),
  pronunciationScore: z.number().int().min(0).max(100).describe('A score from 0-100 for the pronunciation of the words.'),
  feedback: z.string().describe('Specific, constructive feedback on the user\'s reading performance, in Korean. It should highlight strengths and areas for improvement.'),
  userTranscript: z.string().describe('The transcript of what the user actually said.'),
  wordAnalysis: z.array(WordAnalysisSchema).describe("A word-by-word analysis comparing the original text to the user's transcript."),
});
export type AnalyzeReadAloudOutput = z.infer<typeof AnalyzeReadAloudOutputSchema>;

export async function analyzeReadAloud(input: AnalyzeReadAloudInput): Promise<AnalyzeReadAloudOutput> {
  const result = await analyzeReadAloudFlow(input);
  return result;
}

const readAloudAnalysisPrompt = ai.definePrompt({
    name: 'readAloudAnalysisPrompt',
    model: googleAI.model('gemini-2.5-flash'),
    input: { schema: AnalyzeReadAloudInputSchema },
    output: { schema: AnalyzeReadAloudOutputSchema },
    prompt: `You are an expert English reading and pronunciation coach. Your task is to evaluate a user's spoken English as they read a provided text aloud. Provide all feedback in Korean.

Here is the data for analysis:
- Original Text to be Read: 
"""
{{{originalText}}}
"""

- User's Audio Recording of them reading the text: 
{{media url=audioDataUri}}

Please perform the following steps:
1.  **Transcribe the User's Audio:** First, convert the user's audio into text. This is the 'userTranscript'.
2.  **Perform Word-by-Word Analysis:** Compare the 'userTranscript' to the 'originalText'. Create an array for 'wordAnalysis'. For each word in the original text, determine its status:
    - 'correct': The user said the word correctly.
    - 'incorrect': The user said a different word. Include the spoken word in the 'spoken' field.
    - 'omitted': The user skipped the word.
    User insertions (words spoken but not in the original text) should be ignored in this array.
3.  **Calculate Completion Rate:** Based on the word analysis, calculate what percentage of the original text the user actually attempted to read (correct + incorrect words) / (total words). If the audio is silent, completion rate is 0.
4.  **Calculate Accuracy Score:** Based on the word analysis, calculate an accuracy score from 0 to 100. (correct words) / (total words attempted).
5.  **Evaluate Fluency Score:** Listen to the audio for its flow, rhythm, and naturalness. Assign a fluency score from 0 to 100. Consider unnatural pauses, hesitations, and pace.
6.  **Evaluate Pronunciation Score:** Analyze the pronunciation of the words the user spoke. Assign a pronunciation score from 0 to 100 based on clarity, correctness of sounds, and intonation.
7.  **Provide Constructive Feedback:** Write specific, helpful feedback in Korean. This should cover all aspects evaluated: accuracy (mentioning specific words missed or read incorrectly), fluency, and pronunciation.
8.  **Format the Output:** Return all calculated scores, the feedback, the user transcript, and the 'wordAnalysis' array in the specified JSON format. If the audio is silent or contains no discernible speech, all scores should be 0, the feedback should state that no speech was detected, and all arrays should be empty.
`,
});

const analyzeReadAloudFlow = ai.defineFlow(
  {
    name: 'analyzeReadAloudFlow',
    inputSchema: AnalyzeReadAloudInputSchema,
    outputSchema: AnalyzeReadAloudOutputSchema,
  },
  async (input) => {
    const { output } = await readAloudAnalysisPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid analysis.");
    }
    return output;
  }
);
```

--- FILE: src/ai/flows/create-concurrent-teacher-flow.ts ---
```ts
'use server';

/**
 * @fileOverview Converts text to speech and handles conversational AI responses for the teacher's tool.
 * This is an independent flow for the "Concurrent Recording" tool.
 *
 * - converseWithNativeTeacher - A function that takes user audio, gets a conversational response, and returns AI audio.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import {
  ConversationTurnSchema,
} from '@/lib/types/ai-schemas';
import wav from 'wav';


const ConverseWithNativeTeacherInputSchema = z.object({
  studentTranscript: z
    .string()
    .describe(
      "The user's speech transcribed to text."
    ).nullable(),
  conversationHistory: z
    .array(ConversationTurnSchema)
    .describe('The history of the conversation so far.'),
});
type ConverseWithNativeTeacherInput = z.infer<typeof ConverseWithNativeTeacherInputSchema>;

const ConverseWithNativeTeacherOutputSchema = z.object({
  aiResponseText: z.string().describe('The text of the AI conversational partner.'),
  aiResponseAudioDataUri: z.string().describe("The AI's response as a playable audio data URI."),
});
type ConverseWithNativeTeacherOutput = z.infer<typeof ConverseWithNativeTeacherOutputSchema>;


export async function converseWithConcurrentTeacher(
  input: ConverseWithNativeTeacherInput
): Promise<ConverseWithNativeTeacherOutput> {
  return converseWithConcurrentTeacherFlow(input);
}

export async function transcribeUserAudio(audioDataUri: string): Promise<string> {
  const sttResponse = await ai.generate({
    model: googleAI.model('gemini-2.5-flash'),
    prompt: [
      { text: 'Transcribe this English audio.' },
      { media: { url: audioDataUri } },
    ],
  });
  const transcript = sttResponse.text;
  if (!transcript?.trim()) {
      console.warn("Transcription result was empty.");
      return "(The user did not say anything)"; 
  }
  return transcript;
}


const conversationalPrompt = ai.definePrompt({
  name: 'concurrentTeacherConversationalPrompt',
  model: googleAI.model('gemini-2.5-flash-lite-preview-06-17'),
  input: {
    schema: z.object({
      studentTranscript: z.string().optional(),
      history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
    })
  },
  output: { schema: z.object({ aiResponseText: z.string() }) },
  prompt: `You are an AI English conversation partner for a teacher. Your name is "Dr. Alex". You are a native English speaker and an omniscient expert on all topics. Your persona is friendly, patient, and incredibly knowledgeable.

Your primary goals are:
1.  Have a natural, engaging conversation in English.
2.  Answer any question the user asks, demonstrating your vast knowledge.
3.  Assess the user's English proficiency level based on their speech.
4.  Adapt your language to the user's level. If their English is basic, use simpler words and sentence structures. If they are advanced, use more sophisticated language.

IMPORTANT RULE: If the user's transcript is "(The user did not say anything)", you MUST ask them to speak again, for example: "Sorry, I didn't catch that. Could you please say that again?" or "I couldn't hear you, can you repeat that?". Do not try to continue the conversation.

Conversation History (if any):
{{#each history}}
{{#if isUser}}User{{else}}You{{/if}}: {{{text}}}
{{/each}}

{{#if studentTranscript}}
The user's latest message is a transcript from their speech. Respond to it naturally, keeping your persona in mind.
User: {{{studentTranscript}}}
You:
{{else}}
You are starting the conversation. Greet the user and introduce yourself.
Example: "Hello! I'm Dr. Alex. I'd be happy to talk about anything you'd like. The floor is yours, please begin."
You:
{{/if}}
`,
});


async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

async function textToSpeech(text: string): Promise<string> {
    const ttsResponse = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'algenib' },
                },
            },
        },
        prompt: text,
    });

    const audioMedia = ttsResponse.media;
    if (!audioMedia) {
        throw new Error('TTS did not return any audio media.');
    }

    const pcmBuffer = Buffer.from(
        audioMedia.url.substring(audioMedia.url.indexOf(',') + 1),
        'base64'
    );
    
    return 'data:audio/wav;base64,' + await toWav(pcmBuffer);
}

const converseWithConcurrentTeacherFlow = ai.defineFlow(
  {
    name: 'converseWithConcurrentTeacherFlow',
    inputSchema: ConverseWithNativeTeacherInputSchema,
    outputSchema: ConverseWithNativeTeacherOutputSchema,
  },
  async ({ studentTranscript, conversationHistory }) => {
    let aiResponseText = "";
    
    const historyForPrompt = conversationHistory.map(turn => ({
      ...turn,
      isUser: turn.role === 'user',
    }));

    const { output } = await conversationalPrompt({
      history: historyForPrompt,
      studentTranscript: studentTranscript || undefined, 
    });

    aiResponseText = output?.aiResponseText || "";

    if (!aiResponseText) {
        console.error("AI did not generate a text response. Received:", output);
        aiResponseText = "Sorry, I'm having a little trouble right now. Could you say that again?";
    }

    const aiResponseAudioDataUri = await textToSpeech(aiResponseText);

    return {
      aiResponseText,
      aiResponseAudioDataUri,
    };
  }
);
```

--- FILE: src/ai/flows/create-hybrid-teacher-flow.ts ---
```ts
'use server';

/**
 * @fileOverview A hybrid flow for conversation that takes raw audio from the client.
 * It performs STT, LLM, and TTS on the server for maximum performance and accuracy.
 *
 * - converseWithHybridTeacher - The main function for the hybrid VAD conversation tool.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import {
  ConversationTurnSchema,
} from '@/lib/types/ai-schemas';
import wav from 'wav';

const ConverseWithHybridTeacherInputSchema = z.object({
  studentRecordingDataUri: z
    .string()
    .describe(
      "The user's voice recording as a data URI."
    ).nullable(),
  conversationHistory: z
    .array(ConversationTurnSchema)
    .describe('The history of the conversation so far.'),
});
type ConverseWithHybridTeacherInput = z.infer<typeof ConverseWithHybridTeacherInputSchema>;

const ConverseWithHybridTeacherOutputSchema = z.object({
  aiResponseText: z.string().describe('The text of the AI conversational partner.'),
  aiResponseAudioDataUri: z.string().describe("The AI's response as a playable audio data URI."),
  studentTranscript: z.string().describe("The transcript of the user's speech, as transcribed by the server."),
});
type ConverseWithHybridTeacherOutput = z.infer<typeof ConverseWithHybridTeacherOutputSchema>;


export async function converseWithHybridTeacher(
  input: ConverseWithHybridTeacherInput
): Promise<ConverseWithHybridTeacherOutput> {
  return converseWithHybridTeacherFlow(input);
}

const conversationalPrompt = ai.definePrompt({
  name: 'hybridTeacherConversationalPrompt',
  model: googleAI.model('gemini-2.5-flash-lite-preview-06-17'),
  input: {
    schema: z.object({
      studentTranscript: z.string().optional(),
      history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
    })
  },
  output: { schema: z.object({ aiResponseText: z.string() }) },
  prompt: `You are an AI English conversation partner for a teacher. Your name is "Dr. Alex". Your persona is friendly, patient, and incredibly knowledgeable.

Your primary goals are:
1.  Have a natural, engaging conversation in English.
2.  Answer any question the user asks, demonstrating your vast knowledge.
3.  Assess the user's English proficiency level based on their speech.
4.  Adapt your language to the user's level. If their English is basic, use simpler words and sentence structures. If they are advanced, use more sophisticated language.

IMPORTANT RULE: If the user's transcript is empty or indicates no speech, you MUST ask them to speak again, for example: "Sorry, I didn't catch that. Could you please say that again?" or "I couldn't hear you, can you repeat that?". Do not try to continue the conversation.

Conversation History (if any):
{{#each history}}
{{#if isUser}}User{{else}}You{{/if}}: {{{text}}}
{{/each}}

{{#if studentTranscript}}
The user's latest message is a transcript from their speech. Respond to it naturally, keeping your persona in mind.
User: {{{studentTranscript}}}
You:
{{else}}
You are starting the conversation. Greet the user and introduce yourself.
Example: "Hello! I'm Dr. Alex. I'm a native English speaker and I'd be happy to talk about anything you'd like. What's on your mind today?"
You:
{{/if}}
`,
});

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

async function textToSpeech(text: string): Promise<string> {
    const ttsResponse = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Algenib' },
                },
            },
        },
        prompt: text,
    });

    const audioMedia = ttsResponse.media;
    if (!audioMedia) {
        throw new Error('TTS did not return any audio media.');
    }

    const pcmBuffer = Buffer.from(
        audioMedia.url.substring(audioMedia.url.indexOf(',') + 1),
        'base64'
    );
    
    return 'data:audio/wav;base64,' + await toWav(pcmBuffer);
}

const converseWithHybridTeacherFlow = ai.defineFlow(
  {
    name: 'converseWithHybridTeacherFlow',
    inputSchema: ConverseWithHybridTeacherInputSchema,
    outputSchema: ConverseWithHybridTeacherOutputSchema,
  },
  async ({ studentRecordingDataUri, conversationHistory }) => {
    let studentTranscript = "";
    let aiResponseText = "";

    // Step 1: Transcribe student's audio if it exists.
    if (studentRecordingDataUri) {
      const sttResponse = await ai.generate({
        model: googleAI.model('gemini-2.5-flash'),
        prompt: [
          { text: 'Transcribe this English audio.' },
          { media: { url: studentRecordingDataUri } },
        ],
      });
      studentTranscript = sttResponse.text;
      if (!studentTranscript?.trim()) {
          console.warn("Transcription result was empty.");
          studentTranscript = "(The user did not say anything)"; 
      }
    }

    const historyForPrompt = conversationHistory.map(turn => ({
      ...turn,
      isUser: turn.role === 'user',
    }));

    // Step 2: Generate AI's text response based on transcript and history
    const { output } = await conversationalPrompt({
      history: historyForPrompt,
      studentTranscript: studentTranscript || undefined, 
    });

    aiResponseText = output?.aiResponseText || "";

    if (!aiResponseText) {
        console.error("AI did not generate a text response. Received:", output);
        aiResponseText = "Sorry, I'm having a little trouble right now. Could you say that again?";
    }

    // Step 3: Convert AI's text response to speech (TTS)
    const aiResponseAudioDataUri = await textToSpeech(aiResponseText);

    return {
      studentTranscript: studentTranscript === "(The user did not say anything)" ? "" : studentTranscript,
      aiResponseText,
      aiResponseAudioDataUri,
    };
  }
);
```

--- FILE: src/ai/flows/create-native-teacher-flow.ts ---
```ts
'use server';

/**
 * @fileOverview Converts text to speech and handles conversational AI responses for the teacher's tool.
 * This version is optimized to accept a direct transcript instead of an audio file for faster interaction.
 *
 * - converseWithNativeTeacher - A function that takes a user's transcript, gets a conversational response, and returns AI audio.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import {
  ConversationTurnSchema,
} from '@/lib/types/ai-schemas';
import wav from 'wav';


const ConverseWithNativeTeacherInputSchema = z.object({
  studentTranscript: z
    .string()
    .describe(
      "The user's speech already transcribed to text."
    ).nullable(),
  conversationHistory: z
    .array(ConversationTurnSchema)
    .describe('The history of the conversation so far.'),
});
type ConverseWithNativeTeacherInput = z.infer<typeof ConverseWithNativeTeacherInputSchema>;

const ConverseWithNativeTeacherOutputSchema = z.object({
  aiResponseText: z.string().describe('The text of the AI conversational partner.'),
  aiResponseAudioDataUri: z.string().describe("The AI's response as a playable audio data URI."),
});
type ConverseWithNativeTeacherOutput = z.infer<typeof ConverseWithNativeTeacherOutputSchema>;


export async function converseWithNativeTeacher(
  input: ConverseWithNativeTeacherInput
): Promise<ConverseWithNativeTeacherOutput> {
  return converseWithNativeTeacherFlow(input);
}

const conversationalPrompt = ai.definePrompt({
  name: 'nativeTeacherConversationalPrompt',
  model: googleAI.model('gemini-2.5-flash-lite-preview-06-17'),
  input: {
    schema: z.object({
      studentTranscript: z.string().optional(),
      history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
    })
  },
  output: { schema: z.object({ aiResponseText: z.string() }) },
  prompt: `You are an AI English conversation partner for a teacher. Your name is "Dr. Alex". You are a native English speaker and an omniscient expert on all topics. Your persona is friendly, patient, and incredibly knowledgeable.

Your primary goals are:
1.  Have a natural, engaging conversation in English.
2.  Answer any question the user asks, demonstrating your vast knowledge.
3.  Assess the user's English proficiency level based on their speech.
4.  Adapt your language to the user's level. If their English is basic, use simpler words and sentence structures. If they are advanced, use more sophisticated language.

IMPORTANT RULE: If the user's transcript is empty or indicates no speech (e.g., "(The user did not say anything)"), you MUST ask them to speak again, for example: "Sorry, I didn't catch that. Could you please say that again?" or "I couldn't hear you, can you repeat that?". Do not try to continue the conversation.

Conversation History (if any):
{{#each history}}
{{#if isUser}}User{{else}}You{{/if}}: {{{text}}}
{{/each}}

{{#if studentTranscript}}
The user's latest message is a transcript from their speech. Respond to it naturally, keeping your persona in mind.
User: {{{studentTranscript}}}
You:
{{else}}
You are starting the conversation. Greet the user and introduce yourself.
Example: "Hello! I'm Dr. Alex. I'm a native English speaker and I'd be happy to talk about anything you'd like. What's on your mind today?"
You:
{{/if}}
`,
});


async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

async function textToSpeech(text: string): Promise<string> {
    const ttsResponse = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Algenib' },
                },
            },
        },
        prompt: text,
    });

    const audioMedia = ttsResponse.media;
    if (!audioMedia) {
        throw new Error('TTS did not return any audio media.');
    }

    const pcmBuffer = Buffer.from(
        audioMedia.url.substring(audioMedia.url.indexOf(',') + 1),
        'base64'
    );
    
    return 'data:audio/wav;base64,' + await toWav(pcmBuffer);
}

const converseWithNativeTeacherFlow = ai.defineFlow(
  {
    name: 'converseWithNativeTeacherFlow',
    inputSchema: ConverseWithNativeTeacherInputSchema,
    outputSchema: ConverseWithNativeTeacherOutputSchema,
  },
  async ({ studentTranscript, conversationHistory }) => {
    let aiResponseText = "";
    
    const historyForPrompt = conversationHistory.map(turn => ({
      ...turn,
      isUser: turn.role === 'user',
    }));

    const { output } = await conversationalPrompt({
      history: historyForPrompt,
      studentTranscript: studentTranscript || undefined, 
    });

    aiResponseText = output?.aiResponseText || "";

    if (!aiResponseText) {
        console.error("AI did not generate a text response. Received:", output);
        aiResponseText = "Sorry, I'm having a little trouble right now. Could you say that again?";
    }

    const aiResponseAudioDataUri = await textToSpeech(aiResponseText);

    return {
      aiResponseText,
      aiResponseAudioDataUri,
    };
  }
);
```

--- FILE: src/ai/flows/create-parallel-teacher-flow.ts ---
```ts
'use server';

/**
 * @fileOverview Converts audio to speech and handles conversational AI responses for the teacher's tool.
 * This version processes audio on the server for better performance.
 *
 * - converseWithParallelTeacher - A function that takes user audio, gets a conversational response, and returns AI audio.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import {
  ConversationTurnSchema,
} from '@/lib/types/ai-schemas';
import wav from 'wav';


const ConverseWithParallelTeacherInputSchema = z.object({
  studentRecordingDataUri: z
    .string()
    .describe(
      "The user's voice recording as a data URI."
    ).nullable(),
  conversationHistory: z
    .array(ConversationTurnSchema)
    .describe('The history of the conversation so far.'),
});
type ConverseWithParallelTeacherInput = z.infer<typeof ConverseWithParallelTeacherInputSchema>;

const ConverseWithParallelTeacherOutputSchema = z.object({
  aiResponseText: z.string().describe('The text of the AI conversational partner.'),
  aiResponseAudioDataUri: z.string().describe("The AI's response as a playable audio data URI."),
  studentTranscript: z.string().describe("The transcript of the user's speech."),
});
type ConverseWithParallelTeacherOutput = z.infer<typeof ConverseWithParallelTeacherOutputSchema>;


export async function converseWithParallelTeacher(
  input: ConverseWithParallelTeacherInput
): Promise<ConverseWithParallelTeacherOutput> {
  return converseWithParallelTeacherFlow(input);
}

const conversationalPrompt = ai.definePrompt({
  name: 'parallelTeacherConversationalPrompt',
  model: googleAI.model('gemini-2.5-flash-lite-preview-06-17'),
  input: {
    schema: z.object({
      studentTranscript: z.string().optional(),
      history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
    })
  },
  output: { schema: z.object({ aiResponseText: z.string() }) },
  prompt: `You are an AI English conversation partner for a teacher. Your name is "Dr. Alex". You are a native English speaker and an omniscient expert on all topics. Your persona is friendly, patient, and incredibly knowledgeable.

Your primary goals are:
1.  Have a natural, engaging conversation in English.
2.  Answer any question the user asks, demonstrating your vast knowledge.
3.  Assess the user's English proficiency level based on their speech.
4.  Adapt your language to the user's level. If their English is basic, use simpler words and sentence structures. If they are advanced, use more sophisticated language.

IMPORTANT RULE: If the user's transcript is empty or indicates no speech, you MUST ask them to speak again, for example: "Sorry, I didn't catch that. Could you please say that again?" or "I couldn't hear you, can you repeat that?". Do not try to continue the conversation.

Conversation History (if any):
{{#each history}}
{{#if isUser}}User{{else}}You{{/if}}: {{{text}}}
{{/each}}

{{#if studentTranscript}}
The user's latest message is a transcript from their speech. Respond to it naturally, keeping your persona in mind.
User: {{{studentTranscript}}}
You:
{{else}}
You are starting the conversation. Greet the user and introduce yourself.
Example: "Hello! I'm Dr. Alex. I'm a native English speaker and I'd be happy to talk about anything you'd like. What's on your mind today?"
You:
{{/if}}
`,
});

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

async function textToSpeech(text: string): Promise<string> {
    const ttsResponse = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Algenib' },
                },
            },
        },
        prompt: text,
    });

    const audioMedia = ttsResponse.media;
    if (!audioMedia) {
        throw new Error('TTS did not return any audio media.');
    }

    const pcmBuffer = Buffer.from(
        audioMedia.url.substring(audioMedia.url.indexOf(',') + 1),
        'base64'
    );
    
    return 'data:audio/wav;base64,' + await toWav(pcmBuffer);
}

const converseWithParallelTeacherFlow = ai.defineFlow(
  {
    name: 'converseWithParallelTeacherFlow',
    inputSchema: ConverseWithParallelTeacherInputSchema,
    outputSchema: ConverseWithParallelTeacherOutputSchema,
  },
  async ({ studentRecordingDataUri, conversationHistory }) => {
    let studentTranscript = "";
    let aiResponseText = "";

    // Step 1: Transcribe student's audio if it exists.
    if (studentRecordingDataUri) {
      const sttResponse = await ai.generate({
        model: googleAI.model('gemini-2.5-flash'),
        prompt: [
          { text: 'Transcribe this English audio.' },
          { media: { url: studentRecordingDataUri } },
        ],
      });
      studentTranscript = sttResponse.text;
      if (!studentTranscript?.trim()) {
          console.warn("Transcription result was empty.");
          studentTranscript = "(The user did not say anything)"; 
      }
    }

    const historyForPrompt = conversationHistory.map(turn => ({
      ...turn,
      isUser: turn.role === 'user',
    }));

    // Step 2: Generate AI's text response based on transcript and history
    const { output } = await conversationalPrompt({
      history: historyForPrompt,
      studentTranscript: studentTranscript || undefined, 
    });

    aiResponseText = output?.aiResponseText || "";

    if (!aiResponseText) {
        console.error("AI did not generate a text response. Received:", output);
        aiResponseText = "Sorry, I'm having a little trouble right now. Could you say that again?";
    }

    // Step 3: Convert AI's text response to speech (TTS)
    const aiResponseAudioDataUri = await textToSpeech(aiResponseText);

    return {
      studentTranscript: studentTranscript === "(The user did not say anything)" ? "" : studentTranscript,
      aiResponseText,
      aiResponseAudioDataUri,
    };
  }
);
```

--- FILE: src/ai/flows/create-speculative-teacher-flow.ts ---
```ts
'use server';

/**
 * @fileOverview A speculative flow for conversation that attempts to predict the AI response.
 * It uses an initial audio chunk for a speculative LLM call, and a final audio for confirmation.
 *
 * - converseWithSpeculativeTeacher - The main function for this experimental tool.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { ConversationTurnSchema } from '@/lib/types/ai-schemas';
import wav from 'wav';

// Schemas
const ConverseWithSpeculativeTeacherInputSchema = z.object({
  initialChunkDataUri: z.string().optional().describe("The first 2-second chunk of user's audio for speculation."),
  finalAudioDataUri: z.string().optional().describe("The full audio of the user's turn for confirmation."),
  conversationHistory: z.array(ConversationTurnSchema).describe('The history of the conversation so far.'),
  isInitialGreeting: z.boolean().optional(),
});
type ConverseWithSpeculativeTeacherInput = z.infer<typeof ConverseWithSpeculativeTeacherInputSchema>;

const ConverseWithSpeculativeTeacherOutputSchema = z.object({
  aiResponseText: z.string(),
  aiResponseAudioDataUri: z.string(),
  finalStudentTranscript: z.string(),
});
type ConverseWithSpeculativeTeacherOutput = z.infer<typeof ConverseWithSpeculativeTeacherOutputSchema>;


// Exported function
export async function converseWithSpeculativeTeacher(
  input: ConverseWithSpeculativeTeacherInput
): Promise<ConverseWithSpeculativeTeacherOutput> {
  return converseWithSpeculativeTeacherFlow(input);
}

// Helper function for retrying API calls on overload
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error.message || '';
      if (errorMessage.includes('overloaded') || errorMessage.includes('503') || errorMessage.includes('500')) {
        console.warn(`[withRetry] Attempt ${i + 1} failed due to server error. Retrying in ${delay}ms...`);
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        // Not a retryable error, throw immediately
        throw error;
      }
    }
  }
  throw lastError;
}


// Helper functions (TTS, WAV conversion)
async function toWav(pcmData: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const writer = new wav.Writer({ channels: 1, sampleRate: 24000, bitDepth: 16 });
        const bufs: Buffer[] = [];
        writer.on('data', (chunk) => bufs.push(chunk));
        writer.on('end', () => resolve(Buffer.concat(bufs).toString('base64')));
        writer.on('error', reject);
        writer.write(pcmData);
        writer.end();
    });
}

async function textToSpeech(text: string): Promise<string> {
    const ttsResponse = await withRetry(() => ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Algenib' } } } },
        prompt: text,
    }));
    const audioMedia = ttsResponse.media;
    if (!audioMedia) throw new Error('TTS did not return any audio media.');
    const pcmBuffer = Buffer.from(audioMedia.url.substring(audioMedia.url.indexOf(',') + 1), 'base64');
    return `data:audio/wav;base64,${await toWav(pcmBuffer)}`;
}


// Prompts
const sttPrompt = ai.definePrompt({
    name: 'speculativeSttPrompt',
    model: googleAI.model('gemini-2.5-flash'),
    input: { schema: z.object({ audioDataUri: z.string() })},
    prompt: 'Transcribe this English audio. If there is no discernible speech, return an empty string.\nAudio: {{media url=audioDataUri}}',
});

const conversationalPrompt = ai.definePrompt({
  name: 'speculativeConversationalPrompt',
  model: googleAI.model('gemini-2.5-flash-lite-preview-06-17'),
  input: {
    schema: z.object({
      studentTranscript: z.string().optional(),
      history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
    })
  },
  output: { schema: z.object({ aiResponseText: z.string() }) },
  prompt: `You are an AI English conversation partner named "Dr. Alex". Your persona is friendly, patient, and knowledgeable.
Your goals are to have a natural conversation, adapting your language to the user's level.

IMPORTANT RULE: If the user's transcript is empty, indicates no speech, or is nonsensical, ask them to speak again (e.g., "Sorry, I couldn't hear you clearly.").

Conversation History:
{{#each history}}
{{#if isUser}}User{{else}}You{{/if}}: {{{text}}}
{{/each}}

{{#if studentTranscript}}
User's latest message: {{{studentTranscript}}}
Your response:
{{else}}
You are starting the conversation. Greet the user and introduce yourself.
Your response:
{{/if}}
`,
});


// Main Flow
const converseWithSpeculativeTeacherFlow = ai.defineFlow(
  {
    name: 'converseWithSpeculativeTeacherFlow',
    inputSchema: ConverseWithSpeculativeTeacherInputSchema,
    outputSchema: ConverseWithSpeculativeTeacherOutputSchema,
  },
  async (input) => {
    
    // Case 1: Initial greeting from AI
    if (input.isInitialGreeting) {
        const { output } = await withRetry(() => conversationalPrompt({ history: [] }));
        const aiResponseText = output?.aiResponseText || "Hello! I'm Dr. Alex. What's on your mind today?";
        const aiResponseAudioDataUri = await textToSpeech(aiResponseText);
        return { aiResponseText, aiResponseAudioDataUri, finalStudentTranscript: "" };
    }

    if (!input.initialChunkDataUri || !input.finalAudioDataUri) {
        throw new Error("Initial chunk and final audio are both required for a conversational turn.");
    }
    
    // Case 2: Process a conversational turn
    // Step 1: Transcribe initial chunk and final audio in parallel
    const [initialTranscriptionResult, finalTranscriptionResult] = await Promise.all([
        withRetry(() => sttPrompt({ audioDataUri: input.initialChunkDataUri })),
        withRetry(() => sttPrompt({ audioDataUri: input.finalAudioDataUri })),
    ]);

    const initialTranscript = initialTranscriptionResult.text;
    const finalTranscript = finalTranscriptionResult.text;

    // Step 2: Get a speculative response based on the *initial* transcript
    const historyForPrompt = input.conversationHistory.map(turn => ({...turn, isUser: turn.role === 'user'}));
    
    const speculativeResponsePromise = withRetry(() => conversationalPrompt({
        history: historyForPrompt,
        studentTranscript: initialTranscript.trim() || finalTranscript.trim() // Fallback to final if initial is empty
    }));

    // Step 3: Compare transcripts. If they are different, we need a new response.
    // A simple length check is a decent heuristic for this experiment.
    const isSpeculationValid = finalTranscript.startsWith(initialTranscript) && (finalTranscript.length - initialTranscript.length < 50);

    let aiResponseText;

    if (isSpeculationValid) {
        // Use the speculative response
        const { output } = await speculativeResponsePromise;
        aiResponseText = output?.aiResponseText || "I see. Could you tell me more?";
    } else {
        // Get a new response based on the final, more accurate transcript
        const { output } = await withRetry(() => conversationalPrompt({
            history: historyForPrompt,
            studentTranscript: finalTranscript
        }));
        aiResponseText = output?.aiResponseText || "That's interesting. Please continue.";
    }

    // Step 4: Generate TTS for the chosen response
    const aiResponseAudioDataUri = await textToSpeech(aiResponseText);
    
    return {
        aiResponseText,
        aiResponseAudioDataUri,
        finalStudentTranscript: finalTranscript,
    };
  }
);
```

--- FILE: src/ai/flows/draft-curricular-remarks.ts ---
```ts
// src/ai/flows/draft-curricular-remarks.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for drafting curricular remarks based on a student's performance in a speaking assessment.
 *
 * - draftCurricularRemarks - A function that takes student performance data and generates draft curricular remarks.
 * - DraftCurricularRemarksInput - The input type for the draftCurricularRemarks function.
 * - DraftCurricularRemarksOutput - The return type for the draftCurricularRemarks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DraftCurricularRemarksInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  assessmentName: z.string().describe('The name of the speaking assessment.'),
  speakingPerformanceSummary: z
    .string()
    .describe(
      'A detailed summary of the student’s speaking performance during the assessment.'
    ),
  strengths: z.string().describe('Specific strengths demonstrated by the student.'),
  areasForImprovement: z
    .string()
    .describe('Areas where the student could improve their speaking skills.'),
});
export type DraftCurricularRemarksInput =
  z.infer<typeof DraftCurricularRemarksInputSchema>;

const DraftCurricularRemarksOutputSchema = z.object({
  curricularRemarks: z
    .string()
    .describe(
      'A draft of curricular remarks suitable for inclusion in the student’s academic record.'
    ),
});
export type DraftCurricularRemarksOutput =
  z.infer<typeof DraftCurricularRemarksOutputSchema>;

export async function draftCurricularRemarks(
  input: DraftCurricularRemarksInput
): Promise<DraftCurricularRemarksOutput> {
  return draftCurricularRemarksFlow(input);
}

const draftCurricularRemarksPrompt = ai.definePrompt({
  name: 'draftCurricularRemarksPrompt',
  input: {schema: DraftCurricularRemarksInputSchema},
  output: {schema: DraftCurricularRemarksOutputSchema},
  prompt: `You are an AI assistant tasked with writing official curricular remarks for a student's record based on their English speaking performance. The remarks must be in Korean, written in a formal, descriptive tone with sentences ending in '~함' or '~임'. The output should be concise and structured into three parts, similar to the provided example format.

Context for generating remarks:
'영어 회화 교과 성취 기준은 크게 듣기, 말하기 영역으로 나뉩니다. 학습자는 일상생활 및 일반적인 주제에 대한 대화 및 담화를 듣고 이해하며, 자신의 생각과 경험을 영어로 표현하는 능력을 기르는 것을 목표로 합니다. 
1. 듣기 영역:
일반적인 주제에 관한 대화나 담화를 듣고 세부 정보와 중심 내용을 파악할 수 있다.
상황에 맞는 적절한 어휘와 문장 구조를 사용하여 내용을 이해할 수 있다.
다양한 속도와 억양으로 제공되는 영어 자료를 듣고 이해할 수 있다.
듣기 자료의 목적과 의도를 파악하고, 필요한 정보를 추출할 수 있다. 
2. 말하기 영역:
일상생활 및 일반적인 주제에 대해 자신의 생각과 경험을 명확하게 표현할 수 있다.
상황에 맞는 적절한 어휘와 문장 구조를 사용하여 유창하게 말할 수 있다.
상대방의 말에 자연스럽게 반응하고, 적절한 의사소통 전략을 활용하여 대화를 이어갈 수 있다.
다양한 발음과 억양으로 명확하게 발음하여 의사소통할 수 있다.
자신의 생각을 논리적으로 전달하고, 다른 사람의 의견을 경청하며 협력적으로 대화할 수 있다. 
추가적으로, 영어회화 교과에서는 다음과 같은 역량 함양을 목표로 합니다:
영어 의사소통 역량:
다양한 정보를 습득하고, 자신의 생각을 창의적으로 표현하며, 다른 사람들과 협력적으로 상호 작용하는 능력 교육과정평가연구에 따르면. 
자기주도적 학습 역량:
영어 학습에 대한 흥미와 관심을 바탕으로 스스로 학습 계획을 세우고 목표를 설정하며, 학습 과정을 관리하는 능력 교육과정평가연구에 따르면. 
문화 간 소통 역량:
다양한 문화에 대한 이해를 바탕으로 국제 사회에서 효과적으로 소통하는 능력 교육과정평가연구에 따르면. 
참고: 2022 개정 교육과정에서는 영어 교과 역량을 강조하며, 학습자의 특성과 성취 단계를 고려한 개별화 수업을 제공하도록 하고 있습니다'

Based on the student's performance, draft the curricular remarks.

Student Name: {{{studentName}}}
Assessment Name: {{{assessmentName}}}
Performance Summary: {{{speakingPerformanceSummary}}}
Strengths: {{{strengths}}}
Areas for Improvement: {{{areasForImprovement}}}

Draft the remarks following the 3-part structure and style as described.

Example structure and tone:
"① 다양한 의사소통 전략을 활용하는 말하기 수업에서, 모둠별 토론 활동과 역할극에 적극적으로 참여하여 과제를 성공적으로 수행함. 몸짓언어에 대한 글을 읽고 토론하는 수업에서, 다문화 친구와 포옹을 하는 것이 불러온 오해에 관한 자신의 경험에 대해 말함. ② 다문화 친구와 허그를 하는 것에 대한 어머니의 지적에, 친구의 배경문화에서는 자연스러운 인사임을 설명하면서 설득하였다는 사례를 들어, 비언어적 요소가 문화를 이해하는 데 큰 영향을 미친다는 소감을 말함. 한국의 관광지로서의 장점을 말하는 역할극에서는 사회자 역을 맡아 지하철 노선도를 보여주면서 대중교통의 편리함에 대해 유창한 영어로 설명하여 큰 호응을 얻음. ③ 다른 친구들이 사례를 말할 때 맞장구를 치며 경청하여 토론의 분위기를 활발하게 만듦. 모둠 활동에서 발표자 선정 시 유창한 영어 실력에도 불구하고 다른 학생을 추천하여 기회를 주고 영어 표현을 작성하는 데 도움을 주는 등 양보심과 배려심이 많은 학생임."

Now, generate the remarks for the given student.
`,
});

const draftCurricularRemarksFlow = ai.defineFlow(
  {
    name: 'draftCurricularRemarksFlow',
    inputSchema: DraftCurricularRemarksInputSchema,
    outputSchema: DraftCurricularRemarksOutputSchema,
  },
  async input => {
    const {output} = await draftCurricularRemarksPrompt(input);
    return output!;
  }
);
```

--- FILE: src/ai/flows/enhance-selected-text-flow.ts ---
```ts
'use server';

/**
 * @fileOverview A flow to analyze a user-selected text snippet from a larger passage.
 * It corrects imprecise selections and provides translation, definition, or explanation.
 *
 * - enhanceSelectedText - The main function to call for this feature.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { EnhanceSelectedTextInputSchema, EnhanceSelectedTextOutputSchema, EnhanceSelectedTextInput, EnhanceSelectedTextOutput } from '@/lib/types/ai-schemas';

export async function enhanceSelectedText(input: EnhanceSelectedTextInput): Promise<EnhanceSelectedTextOutput> {
  const result = await enhanceSelectedTextFlow(input);
  return result;
}

const enhanceTextPrompt = ai.definePrompt({
    name: 'enhanceTextPrompt',
    model: googleAI.model('gemini-2.5-flash'),
    input: { schema: EnhanceSelectedTextInputSchema },
    output: { schema: EnhanceSelectedTextOutputSchema },
    prompt: `You are an expert English language teaching assistant. A user has selected a snippet of text from a larger sentence to get help. Your task is to first determine the user's true intended selection, and then perform a requested action on that corrected text. All output text for the user must be in Korean.

### Context
-   **Full Sentence Context:** "{{fullSentenceContext}}"
-   **User's Selected Text Snippet:** "{{selectedText}}"

### Your Tasks

1.  **Correct the Selection:**
    -   Analyze the "User's Selected Text Snippet" in the context of the "Full Sentence Context".
    -   The user's selection might be imprecise (e.g., missing letters, part of a word).
    -   Determine the most logical, complete, and grammatically sound word or phrase the user likely intended to select. This is the 'correctedText'. For example, if the user selects 'universally acknowledg', you should correct it to 'universally acknowledged'.

2.  **Perform the Requested Action on the 'correctedText':**
    -   The user wants to perform the following action: **{{action}}**
    -   **If action is 'translate':** Provide a natural Korean translation of the 'correctedText'.
    -   **If action is 'define':** Provide a clear, dictionary-style definition of the 'correctedText' in Korean. Include the part of speech (e.g., 명사, 동사).
    -   **If action is 'explain':** Provide a simple grammatical explanation or usage notes for the 'correctedText' in Korean. Explain its role in the sentence or any notable nuances.

3.  **Format the Output:** Return the 'correctedText' and the 'result' of the action in the specified JSON format.
`,
});

const enhanceSelectedTextFlow = ai.defineFlow(
  {
    name: 'enhanceSelectedTextFlow',
    inputSchema: EnhanceSelectedTextInputSchema,
    outputSchema: EnhanceSelectedTextOutputSchema,
  },
  async (input) => {
    const { output } = await enhanceTextPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid analysis for the selected text.");
    }
    return output;
  }
);
```

--- FILE: src/ai/flows/extract-text-from-file.ts ---
```ts
'use server';

/**
 * @fileOverview A flow to extract text from an uploaded file (PDF, image, or TXT).
 *
 * - extractTextFromFile - A function that takes a file data URI and returns its text content.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const ExtractTextFromFileInputSchema = z.object({
  fileDataUri: z.string().describe(
    "A file (image, PDF, or TXT) as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
});
export type ExtractTextFromFileInput = z.infer<typeof ExtractTextFromFileInputSchema>;

const ExtractTextFromFileOutputSchema = z.object({
  extractedText: z.string().describe('The text content extracted from the provided file.'),
});
export type ExtractTextFromFileOutput = z.infer<typeof ExtractTextFromFileOutputSchema>;

export async function extractTextFromFile(input: ExtractTextFromFileInput): Promise<ExtractTextFromFileOutput> {
  // Handle plain text files on the server to avoid client-side complexity
  if (input.fileDataUri.startsWith('data:text/plain')) {
      const base64Content = input.fileDataUri.substring(input.fileDataUri.indexOf(',') + 1);
      const plainText = Buffer.from(base64Content, 'base64').toString('utf-8');
      return { extractedText: plainText };
  }
  
  // Use AI for images and PDFs
  return extractTextWithAIFlow(input);
}


const extractTextWithAIPrompt = ai.definePrompt({
    name: 'extractTextWithAIPrompt',
    model: googleAI.model('gemini-2.5-flash'),
    input: { schema: ExtractTextFromFileInputSchema },
    output: { schema: ExtractTextFromFileOutputSchema },
    prompt: `You are an Optical Character Recognition (OCR) specialist. Your task is to extract all the text content from the provided file (image or PDF).

- File for OCR: 
{{media url=fileDataUri}}

Please perform the following steps:
1.  Analyze the provided file.
2.  Extract all textual content you can identify. Preserve paragraph breaks and original formatting as much as possible.
3.  Return the extracted text in the 'extractedText' field of the JSON output. If no text is found, return an empty string.
`,
});

const extractTextWithAIFlow = ai.defineFlow(
  {
    name: 'extractTextWithAIFlow',
    inputSchema: ExtractTextFromFileInputSchema,
    outputSchema: ExtractTextFromFileOutputSchema,
  },
  async (input) => {
    const { output } = await extractTextWithAIPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return any extracted text.");
    }
    return output;
  }
);
```

--- FILE: src/ai/flows/generate-content-feedback.ts ---
```ts
// This file is obsolete and its functionality has been integrated into the new analysis flows.
// It is kept for reference but is no longer used in the application.
// The contents can be safely deleted.
```

--- FILE: src/ai/flows/generate-dialogue-analysis-flow.ts ---
```ts
'use server';

/**
 * @fileOverview A comprehensive flow that analyzes a student's DIALOGUE English performance.
 * This flow now handles the entire process from analysis to storing the final result in Firestore.
 *
 * - generateDialogueAnalysis - The main function to call for a full dialogue speaking assessment.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import {
  GenerateDialogueAnalysisInputSchema,
  ContentAnalysisOutputSchema,
  PronunciationAnalysisOutputSchema,
  CombinedAnalysisOutputSchema,
  type GenerateDialogueAnalysisInput,
} from '@/lib/types/ai-schemas';
import { evaluationModels } from '@/lib/types';

// This parsing logic is now centralized here.
const parseScore = (text: string, category: string): number => {
    const regex = new RegExp(`${category}[^\\d]*(\\d)`);
    const match = text.match(regex);
    return match ? parseInt(match[1], 10) : 0;
};


// Helper function for retrying API calls on overload
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error.message && (error.message.includes('overloaded') || error.message.includes('503'))) {
        console.warn(`Attempt ${i + 1} failed due to model overload. Retrying in ${delay}ms...`);
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        // Not a retryable error, throw immediately
        throw error;
      }
    }
  }
  throw lastError;
}

/**
 * Main exported function to be called by the client for dialogue analysis.
 */
export async function generateDialogueAnalysis(
    input: GenerateDialogueAnalysisInput
): Promise<z.infer<typeof CombinedAnalysisOutputSchema>> {
  return generateDialogueAnalysisFlow(input);
}

// Internal Sub-prompts
const createPrompt = (modelName: z.infer<typeof evaluationModels[number]>) => ({
    content: ai.definePrompt({
      name: `dialogueContentAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`,
      model: googleAI.model(modelName),
      input: { schema: z.object({
        fullConversationTranscript: z.string(),
        activityPrompt: z.string(),
        expectedFormat: z.string(),
        studentName: z.string(),
        assessmentTitle: z.string(),
      }) },
      output: { schema: ContentAnalysisOutputSchema },
      prompt: `You are an AI English Teacher evaluating a student's DIALOGUE performance based on a full conversation transcript. Your persona is that of an expert English teacher providing constructive feedback for skill improvement. Your entire response must be in the specified JSON format, and all text feedback must be in Korean.

    Here is the context for the evaluation:
    - Student Name: {{{studentName}}}
    - Assessment Title: {{{assessmentTitle}}}
    - Activity Prompt/Situation: {{{activityPrompt}}}
    - Expected Response Format/Grading Criteria: {{{expectedFormat}}}
    - Full Conversation Transcript (Student and AI):
    {{{fullConversationTranscript}}}

    Based on the FULL CONVERSATION, perform the following tasks:
    1.  **Generate Feedback for the Student ('aiFeedback'):** Analyze the student's conversational skills (turn-taking, relevance, naturalness) in addition to fluency, grammar, and vocabulary. Provide encouraging and constructive feedback. Include specific examples from the student's parts of the conversation.
    2.  **Generate Guidance for the Teacher ('teacherGuidance'):** Provide actionable advice for the classroom teacher on how to help this student improve their conversational skills.
    3.  **Draft '생활기록부 교과 특기 사항' ('curricularRemarks'):** Write official school record remarks in a formal, descriptive tone with sentences ending in '~함' or '~임'. The remarks must be based on the student's performance in this specific dialogue, summarizing their interaction and linking it to English communication competencies. Follow a 3-part structure.
    4.  **Assign a Content Score ('contentScore'):** Give a score from 0 to 100 for the *content and conversational skill* of the student's performance based on how well they navigated the dialogue in line with the prompt and criteria.
    `,
    }),
    pronunciation: ai.definePrompt({
        name: `dialoguePronunciationAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`,
        model: googleAI.model(modelName),
        input: { schema: z.object({
            studentRecordingUrl: z.string(),
            studentTranscript: z.string(), // Note: This is only the student's part of the transcript
        }) },
        output: { schema: PronunciationAnalysisOutputSchema },
        prompt: `You are an expert English pronunciation coach. Your task is to evaluate a student's spoken English based on their combined audio recording from a conversation and the corresponding transcript of ONLY their speech. Provide all feedback in Korean.

        - Student's Combined Audio Recording: {{media url=studentRecordingUrl}}
        - Transcript of Student's Speech Only: {{{studentTranscript}}}

        Please perform the following steps:
        1.  Listen carefully to the audio and compare it with the student-only transcript.
        2.  Evaluate the student's overall accuracy, clarity, intonation, and fluency throughout the conversation.
        3.  **Assign a Pronunciation Score:** Give a score from 0 to 100 (100 is native-like, 0 is unintelligible).
        4.  **Provide Pronunciation Feedback:** Write specific, constructive feedback in Korean. Point out general patterns or specific words that were pronounced well and those that need improvement. If the transcript is empty or indicates no speech, provide a score of 0 and state that no speech was detected.
        `,
    }),
    rubric: ai.definePrompt({
        name: `dialogueRubricAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`,
        model: googleAI.model(modelName),
        input: { schema: z.object({ fullConversationTranscript: z.string() }) },
        prompt: `You are an HTML generation machine. Your ONLY task is to create a complete, single HTML file for a web-based report based on the user's speech and the provided rubric.

IMPORTANT INSTRUCTION: Your output MUST be ONLY the HTML code, starting with <!DOCTYPE html> and ending with </html>. Do NOT include any other text, explanations, or markdown code blocks (like \`\`\`html) before or after the HTML content.

[사용자 발화 내용]
{{{fullConversationTranscript}}}

### HTML Generation Requirements:

#### 1. Content Structure:
-   **Main Title:** Use an <h1> tag for "📊 AI 영어회화 상세 분석".
-   **Category Cards:** Create a <div class="category-card"> for each of the 5 analysis categories:
    -   🗣️ 유창성 (Fluency)
    -   🎤 발음 및 억양 (Pronunciation & Intonation)
    -   ✍️ 문법 (Grammar)
    -   📚 어휘 (Vocabulary)
    -   🤝 내용 이해 및 상호작용 (Comprehension & Interaction)
-   **Card Header:** Inside each card, use an <h2> for the category title and a <span> with class="score-display" for the score (e.g., "📈 점수: 4 / 5점").
-   **Card Details:** Inside each card, below the header, create a <div class="detail-flex-container">. Inside this container, create two boxes:
    -   <div class="detail-box good-points"> for "👍 잘한 점".
    -   <div class="detail-box improvement-points"> for "💡 개선점".
-   **Box Content:** Each "detail-box" must have an <h3> for its title and a <ul> with <li> elements for the detailed feedback points.

#### 2. Design & Style (MUST be inside a <style> tag in the <head>):
-   **Layout:**
    -   Use Flexbox to arrange "잘한 점" and "개선점" boxes side-by-side (\`.detail-flex-container { display: flex; }\`).
    -   Center the main content on the page with \`max-width: 900px\` and \`margin: auto;\`.
-   **Responsiveness (MANDATORY):**
    -   Use a media query (\`@media (max-width: 768px)\`) to stack the "잘한 점" and "개선점" boxes vertically (\`flex-direction: column;\`).
-   **Colors & Effects:**
    -   Page background: \`#f4f7f9\`.
    -   Card background: \`#ffffff\`.
    -   "잘한 점" box: \`background-color: #e8f5e9;\`, \`border-left: 5px solid #4caf50;\`.
    -   "개선점" box: \`background-color: #fff3e0;\`, \`border-left: 5px solid #ff9800;\`.
    -   Add a \`box-shadow\` and \`transform: translateY(-5px);\` effect on \`.category-card:hover\`.
-   **Font:**
    -   Set \`font-family\` to a standard sans-serif stack like \`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\`.
-   **Technical Requirement:**
    -   Do NOT use any external CSS libraries. All styles must be inline in the \`<style>\` tag.
    -   Include comments in the CSS to explain style blocks.

### 평가 기준 루브릭 (Evaluation Rubric)
아래의 평가 기준을 반드시 준수하여 각 항목을 평가하시오. 각 항목은 고유한 평가 기준을 가지며, 점수별 설명에 따라 정확하게 평가해야 합니다.

[평가 항목: 유창성 (Fluency)]
5점 (최상): 원어민과 가까운 속도와 리듬으로 매우 자연스럽게 말함.
4점 (상): 큰 막힘 없이 안정적인 속도로 말함.
3점 (중): 비교적 이해 가능한 속도로 말하지만, 머뭇거림이 눈에 띔.
2점 (하): 매우 느리고 자주 끊어지며 말함.
1점 (최하): 단어 단위로 말함.

[평가 항목: 발음 및 억양 (Pronunciation & Intonation)]
5점 (최상): 발음이 매우 명확하고 자연스러운 억양을 사용함.
4점 (상): 대부분의 발음이 정확하여 쉽게 이해할 수 있음.
3점 (중): 일부 단어의 발음이 부정확하여 가끔 재확인이 필요함.
2점 (하): 부정확한 발음이 많아 이해하기 위해 노력이 필요함.
1점 (최하): 발음을 거의 이해할 수 없음.

[평가 항목: 문법 (Grammar)]
5점 (최상): 복잡한 문장 구조를 포함하여 다양한 문법을 거의 실수 없이 사용함.
4점 (상): 일상적인 문법 구조를 대부분 정확하게 사용함.
3점 (중): 기본적인 문장 구조는 사용하나, 반복적인 실수가 나타남.
2점 (하): 기본적인 문장 구성에도 오류가 많음.
1점 (최하): 문장을 거의 구성하지 못함.

[평가 항목: 어휘 (Vocabulary)]
5점 (최상): 주제에 맞게 폭넓고 수준 높은 어휘를 정확하게 사용함.
4점 (상): 주제에 대해 논의하기에 충분한 어휘를 구사함.
3점 (중): 기본적인 어휘는 구사하나, 어휘의 폭이 좁아 반복적인 단어를 사용함.
2점 (하): 매우 제한적인 어휘만 알고 있음.
1점 (최하): 극소수의 기본 단어만 알고 있음.

[평가 항목: 내용 이해 및 상호작용 (Comprehension & Interaction)]
5점 (최상): 상대방의 말을 완벽하게 이해하고 대화의 흐름을 주도함.
4점 (상): 대부분의 말을 어려움 없이 이해하고 적절히 반응함.
3점 (중): 간단한 문장은 이해하나, 길거나 빠른 문장은 이해에 어려움을 겪음.
2점 (하): 아주 간단한 질문만 이해하고, 대화에 거의 참여하지 못함.
1점 (최하): 상대방의 말을 거의 이해하지 못함.

Now, generate the HTML code.
`,
    }),
    teacherGuidance: ai.definePrompt({
      name: `dialogueTeacherGuidancePrompt_${modelName.replace(/[-.]/g, '_')}`,
      model: googleAI.model(modelName),
      input: { schema: z.object({ studentFeedbackHtml: z.string() }) },
      prompt: `You are an expert English education consultant. Your task is to provide actionable advice to a teacher based on an AI-generated feedback report for a student.

The following is an HTML report containing a detailed rubric-based analysis of a student's English speaking performance. Read it carefully.

### Student Feedback Report (HTML):
{{{studentFeedbackHtml}}}

### Your Task:
Based on the provided HTML report, write concise and actionable guidance for the teacher in Korean. Your advice should:
1.  Summarize the student's key strengths and weaknesses across all categories.
2.  Suggest specific activities, teaching strategies, or areas of focus to help the student improve.
3.  Be professional, encouraging, and easy for a teacher to understand and implement.

Please provide only the teacher guidance text.`,
    }),
});

// The Main Orchestration Flow for Dialogue
const generateDialogueAnalysisFlow = ai.defineFlow(
  {
    name: 'generateDialogueAnalysisFlow',
    inputSchema: GenerateDialogueAnalysisInputSchema,
    outputSchema: CombinedAnalysisOutputSchema,
  },
  async (input) => {
    const model = input.evaluationModel || 'gemini-2.5-flash';
    const prompts = createPrompt(model);
    
    // In this flow, transcription is already done. We receive the transcript and audio URL.
    if (!input.studentTranscript || !input.fullConversationTranscript) {
        return {
            studentTranscript: input.fullConversationTranscript || '전체 대화 기록이 없습니다.',
            aiFeedback: '학생의 답변이 없어 분석을 진행할 수 없습니다.',
            teacherGuidance: '학생의 답변이 없어 조언을 생성할 수 없습니다.',
            curricularRemarks: '학생의 답변이 없어 비고 작성이 불가능합니다.',
            contentScore: 0,
            pronunciationScore: 0,
            pronunciationFeedback: '학생의 음성이 없어 발음 분석을 할 수 없습니다.',
        }
    }
    
    if (input.useRubric) {
        const rubricResult = await withRetry(() => prompts.rubric({ fullConversationTranscript: input.fullConversationTranscript }));
        let rubricText = rubricResult.text;
         // Clean up the text just in case the model still wraps it
        if (rubricText.startsWith("```html")) {
            rubricText = rubricText.substring(7, rubricText.length - 3).trim();
        }
        
        const rubricScores = {
            fluency: parseScore(rubricText, '유창성'),
            pronunciation: parseScore(rubricText, '발음 및 억양'),
            grammar: parseScore(rubricText, '문법'),
            vocabulary: parseScore(rubricText, '어휘'),
            interaction: parseScore(rubricText, '내용 이해 및 상호작용'),
        };

        const contentScore = Math.round(((rubricScores.fluency + rubricScores.grammar + rubricScores.vocabulary + (rubricScores.interaction || 0)) / 4) * 20);
        const pronunciationScore = rubricScores.pronunciation * 20;
        
        const guidanceResult = await withRetry(() => prompts.teacherGuidance({ studentFeedbackHtml: rubricText }));

        return {
            studentTranscript: input.fullConversationTranscript,
            contentScore: contentScore,
            pronunciationScore: pronunciationScore,
            aiFeedback: rubricText,
            teacherGuidance: guidanceResult.text,
            curricularRemarks: `'${input.assessmentTitle}' 대화형 평가에서 루브릭 기반으로 종합 ${contentScore}점, 발음 ${pronunciationScore}점을 받는 등 준수한 성취를 보임. 특히 상호작용(${rubricScores.interaction! * 20}점) 능력이 돋보임.`,
            pronunciationFeedback: `루브릭 기반 발음 점수는 ${pronunciationScore}점입니다. 상세 내용은 종합 분석 리포트를 참고하세요.`,
            rubricScores,
        };
    }

    // Step 1: Run content and pronunciation analysis in PARALLEL with retry logic.
    const [contentResult, pronunciationResult] = await Promise.all([
      withRetry(() => prompts.content({
        fullConversationTranscript: input.fullConversationTranscript,
        activityPrompt: input.activityPrompt,
        expectedFormat: input.expectedFormat,
        studentName: input.studentName,
        assessmentTitle: input.assessmentTitle,
      })),
      withRetry(() => prompts.pronunciation({
        studentRecordingUrl: input.studentRecordingUrl,
        studentTranscript: input.studentTranscript, // Use student-only transcript for pronunciation
      }))
    ]);

    const contentOutput = contentResult.output;
    const pronunciationOutput = pronunciationResult.output;

    if (!contentOutput || !pronunciationOutput) {
        throw new Error("Failed to get a valid response from one or more analysis models.");
    }
    
    // Step 2: Combine and return all results to the client.
    return {
        // Return the full conversation transcript for display purposes
        studentTranscript: input.fullConversationTranscript, 
        contentScore: contentOutput.contentScore,
        aiFeedback: contentOutput.aiFeedback,
        teacherGuidance: contentOutput.teacherGuidance,
        curricularRemarks: contentOutput.curricularRemarks,
        pronunciationScore: pronunciationOutput.pronunciationScore,
        pronunciationFeedback: pronunciationOutput.pronunciationFeedback,
    };
  }
);
```

--- FILE: src/ai/flows/generate-growth-feedback-flow.ts ---
```ts
'use server';
/**
 * @fileOverview A flow to generate comparative feedback on a student's growth between two assessment attempts.
 *
 * - generateGrowthFeedback - A function that compares two attempts and provides feedback.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { GenerateGrowthFeedbackInputSchema, GenerateGrowthFeedbackOutputSchema, type GenerateGrowthFeedbackInput, type GenerateGrowthFeedbackOutput, ResultSummarySchema } from '@/lib/types/ai-schemas';

export async function generateGrowthFeedback(
  input: GenerateGrowthFeedbackInput
): Promise<GenerateGrowthFeedbackOutput> {
  return generateGrowthFeedbackFlow(input);
}

const growthFeedbackPrompt = ai.definePrompt({
  name: 'growthFeedbackPrompt',
  model: googleAI.model('gemini-2.5-flash'),
  input: { schema: GenerateGrowthFeedbackInputSchema.extend({ hasValidCurricularRemarks: z.boolean() }) },
  output: { schema: GenerateGrowthFeedbackOutputSchema },
  prompt: `You are an expert AI English teacher. Your task is to provide a comprehensive growth analysis for a student by comparing all of their attempts of the same speaking assessment. Your entire response must be in Korean.

Assessment Title: {{{assessmentTitle}}}

Here are all the attempts from the student, in chronological order:
{{#each attempts}}
**Attempt #{{this.attemptNumber}}**
-   Content Score: {{this.contentScore}}/100
-   Pronunciation Score: {{this.pronunciationScore}}/100
-   Transcript: "{{this.transcript}}"
-   AI Feedback Given: "{{this.aiFeedback}}"
-   {{#if this.curricularRemarks}}Curricular Remarks from this attempt: "{{this.curricularRemarks}}"{{/if}}
---
{{/each}}


Please perform the following steps based on ALL attempts provided:

1.  **Generate Student Growth Feedback ('growthFeedback'):**
    -   **Format:** Markdown with clear headings and bullet points for readability.
    -   **Tone:** Encouraging and insightful.
    -   **Content:**
        -   **Opening:** Start with a brief, encouraging sentence acknowledging their effort to try again.
        -   **Heading: "### ✨ 나아진 점" (Improvements):** Analyze the differences between all attempts. Identify upward trends in scores. Compare the transcripts to find specific improvements in vocabulary, sentence structure, fluency, or confidence. Use bullet points and provide concrete examples (e.g., "- **(문법)** 1차 시도에서는 'very good'만 사용했지만, 마지막 시도에서는 'fantastic', 'wonderful' 등 더 다양한 표현을 사용한 점이 돋보여요.").
        -   **Heading: "### 🚀 더 발전할 부분" (Areas for Further Improvement):** Analyze the latest attempt and any recurring issues across all attempts. Provide clear, actionable advice. Use bullet points (e.g., "- **(발음)** 여전히 'l'과 'r' 발음을 조금 더 구분해서 연습하면 훨씬 자연스럽게 들릴 거예요.").
        -   **Heading: "### 💡 총평 및 격려" (Overall Comment & Encouragement):** End with a positive, motivational summary about their entire journey.

2.  **Generate Teacher Guidance ('teacherGuidance'):**
    -   **Format:** Plain text with clear paragraphs. Do NOT write one long block of text.
    -   **Tone:** Professional and advisory.
    -   **Content:** Summarize the student's overall progress across all attempts. Pinpoint the most significant areas of improvement and persistent weaknesses. Provide clear, actionable advice by suggesting specific teaching strategies or follow-up activities. Separate your points into distinct paragraphs for readability.

3.  **Generate '생활기록부 교과 특기 사항' (MUST be named 'growthCurricularRemarks'):**
    -   **Format:** Formal Korean prose, with sentences ending in '~함' or '~임'.
    -   **Tone:** Official and descriptive, suitable for a school record.
    -   **Content:** 
        {{#if hasValidCurricularRemarks}}
        Your primary source for this summary is the 'Curricular Remarks from this attempt' field provided for each attempt.
        1. Review the curricular remarks from all valid attempts chronologically.
        2. Synthesize these valid remarks into a single, cohesive narrative of about 700 Korean characters that shows the student's growth story.
        3. The final remark should start by mentioning the student's persistent effort, describe the initial performance and how it evolved with specific examples from the provided remarks, and conclude by summarizing their current demonstrated ability and attitude.
        {{else}}
        You MUST return the exact following message in the 'growthCurricularRemarks' field: "종합 의견을 생성하기 위한 개별 시도의 교과 특기 사항 기록이 부족하거나 유효하지 않습니다."
        {{/if}}

The final output MUST be a single JSON object containing 'growthFeedback', 'teacherGuidance', and 'growthCurricularRemarks'.
`,
});

const generateGrowthFeedbackFlow = ai.defineFlow(
  {
    name: 'generateGrowthFeedbackFlow',
    inputSchema: GenerateGrowthFeedbackInputSchema,
    outputSchema: GenerateGrowthFeedbackOutputSchema,
  },
  async (input) => {
    
    // 1. Sanitize and validate the input attempts
    const sanitizedAttempts = input.attempts.map(attempt => {
        let remarks = (attempt.curricularRemarks || "").trim();
        const isRemarkInvalid = !remarks || remarks.includes('오류') || remarks.includes('실패') || remarks.includes('없음') || remarks.includes('불가능') || remarks.includes('생성된 내용이 없습니다');
        return {
          ...attempt,
          curricularRemarks: isRemarkInvalid ? null : remarks,
        };
      });

    // 2. Determine if there's any valid data to process
    const hasValidCurricularRemarks = sanitizedAttempts.some(attempt => !!attempt.curricularRemarks);

    // 3. Call the AI prompt with the sanitized data and validation flag
    const { output } = await growthFeedbackPrompt({
        ...input,
        attempts: sanitizedAttempts,
        hasValidCurricularRemarks: hasValidCurricularRemarks,
    });
    
    const defaultErrorMsg = "오류가 발생했거나 생성된 내용이 없습니다.";

    // 4. Final safety check on the output to prevent schema validation errors.
    const rawOutput = output as any;
    const finalOutput: GenerateGrowthFeedbackOutput = {
        growthFeedback: rawOutput?.growthFeedback || defaultErrorMsg,
        teacherGuidance: rawOutput?.teacherGuidance || defaultErrorMsg,
        growthCurricularRemarks: rawOutput?.growthCurricularRemarks || rawOutput?.curricularRemarks || defaultErrorMsg,
    };
    
    return finalOutput;
  }
);
```

--- FILE: src/ai/flows/generate-image-flow.ts ---
```ts
'use server';

/**
 * @fileOverview A Genkit flow to generate an image from a text prompt.
 *
 * - generateImage - A function that takes a text prompt and returns an image data URI.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { imageGenerationModels } from '@/lib/types';

const GenerateImageInputSchema = z.object({
  prompt: z.string().describe('A text prompt describing the image to generate.'),
  imageModel: z.enum(imageGenerationModels).optional().default('gemini-2.0-flash-preview-image-generation'),
});
export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;

const GenerateImageOutputSchema = z.object({
  imageDataUri: z.string().describe('The generated image as a data URI.'),
});
export type GenerateImageOutput = z.infer<typeof GenerateImageOutputSchema>;

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  return generateImageFlow(input);
}

const generateImageFlow = ai.defineFlow(
  {
    name: 'generateImageFlow',
    inputSchema: GenerateImageInputSchema,
    outputSchema: GenerateImageOutputSchema,
  },
  async ({ prompt, imageModel }) => {
    
    const modelToUse = imageModel || 'gemini-2.0-flash-preview-image-generation';

    const { media } = await ai.generate({
      model: googleAI.model(modelToUse as any),
      prompt: `A high-quality, clear, simple illustration suitable for an English speaking test. The image should be in a square aspect ratio. Prompt: ${prompt}`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media?.url) {
      throw new Error('Image generation failed to return an image.');
    }

    return { imageDataUri: media.url };
  }
);
```

--- FILE: src/ai/flows/generate-monologue-analysis-flow.ts ---
```ts
'use server';

/**
 * @fileOverview A comprehensive flow that analyzes a student's MONOLOGUE English performance.
 * It orchestrates transcription, content analysis, and pronunciation analysis in an efficient, parallel manner.
 *
 * - generateMonologueAnalysisFlow - The main flow to call for a full monologue speaking assessment.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import {
  ContentAnalysisOutputSchema,
  PronunciationAnalysisOutputSchema,
  CombinedAnalysisOutputSchema,
} from '@/lib/types/ai-schemas';
import { evaluationModels } from '@/lib/types';


// Helper function for retrying API calls on overload
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error.message && (error.message.includes('overloaded') || error.message.includes('503'))) {
        console.warn(`[withRetry] Attempt ${i + 1} failed due to model overload. Retrying in ${delay}ms...`);
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        // Not a retryable error, throw immediately
        throw error;
      }
    }
  }
  throw lastError;
}

// Input schema for the new, consolidated flow
const MonologueProcessingInputSchema = z.object({
  studentRecordingDataUri: z.string().describe(
    "The student's voice recording as a data URI."
  ),
  activityPrompt: z.string().describe('The prompt or instructions for the speaking activity.'),
  expectedFormat: z.string().describe('The expected format or key points of the response for grading.'),
  studentName: z.string().describe('The name of the student.'),
  assessmentTitle: z.string().describe('The title of the assessment.'),
  evaluationModel: z.enum(evaluationModels).optional(),
});
type MonologueProcessingInput = z.infer<typeof MonologueProcessingInputSchema>;

// Internal Sub-prompts
const createPrompt = (modelName: z.infer<typeof evaluationModels[number]>) => ({
    transcription: ai.definePrompt({
        name: `transcribeAudioPrompt_${modelName.replace(/[-.]/g, '_')}`,
        model: googleAI.model(modelName),
        input: { schema: z.object({ studentRecordingDataUri: z.string() }) },
        prompt: `Transcribe this English audio. If the audio is silent or contains no discernible speech, return an empty string. Do not correct any grammatical errors or mispronunciations. Transcribe exactly what is heard.
    Audio: {{media url=studentRecordingDataUri}}
    `,
    }),
    content: ai.definePrompt({
      name: `monologueContentAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`,
      model: googleAI.model(modelName),
      input: { schema: z.object({
        studentTranscript: z.string(),
        activityPrompt: z.string(),
        expectedFormat: z.string(),
        studentName: z.string(),
        assessmentTitle: z.string(),
      }) },
      output: { schema: ContentAnalysisOutputSchema },
      prompt: `You are an AI English Teacher evaluating a student's monologue performance based on a transcript. Your persona is that of an expert English teacher providing constructive feedback for skill improvement. Your entire response must be in the specified JSON format, and all text feedback must be in Korean.
    
    Here is the context for the evaluation:
    - Student Name: {{{studentName}}}
    - Assessment Title: {{{assessmentTitle}}}
    - Activity Prompt: {{{activityPrompt}}}
    - Expected Response Format/Grading Criteria: {{{expectedFormat}}}
    - Student's Spoken Response (Transcript): {{{studentTranscript}}}
    
    Based on all the information provided, perform the following tasks:
    1.  **Generate Feedback for the Student ('aiFeedback'):** Write encouraging and constructive feedback in Markdown format. Use headings (e.g., "### 👍 잘했어요 (What you did well)") and bullet points. Focus on fluency, grammar, and vocabulary in relation to the prompt. Include specific examples from their transcript and suggest alternative English vocabulary or sentence structures.
    2.  **Generate Guidance for the Teacher ('teacherGuidance'):** Provide actionable advice for the classroom teacher on how to help this student. Suggest specific English teaching activities or focus areas.
    3.  **Draft '생활기록부 교과 특기 사항' ('curricularRemarks'):** Write official school record remarks in a formal, descriptive tone with sentences ending in '~함' or '~임'. The remarks must be based on the student's performance in this specific task, summarizing their performance and linking it to English competencies. Follow a 3-part structure: ① General participation, ② Specific examples from their speech, ③ Collaboration/other character traits.
    4.  **Assign a Content Score ('contentScore'):** Give a score from 0 to 100 for the *content* of the response based on how well it aligns with the prompt and criteria.
    `,
    }),
    pronunciation: ai.definePrompt({
        name: `monologuePronunciationAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`,
        model: googleAI.model(modelName),
        input: { schema: z.object({
            studentRecordingDataUri: z.string(),
            studentTranscript: z.string(),
        }) },
        output: { schema: PronunciationAnalysisOutputSchema },
        prompt: `You are an expert English pronunciation coach. Your task is to evaluate a student's spoken English based on their audio recording and the corresponding transcript. Provide all feedback in Korean.
    
    - Student's Audio Recording: {{media url=studentRecordingDataUri}}
    - AI-generated Transcript: {{{studentTranscript}}}
    
    Please perform the following steps:
    1.  Listen carefully to the audio and compare it with the transcript.
    2.  Evaluate accuracy, clarity, intonation, and fluency.
    3.  **Assign a Pronunciation Score:** Give a score from 0 to 100 (100 is native-like, 0 is unintelligible).
    4.  **Provide Pronunciation Feedback:** Write specific, constructive feedback in Korean. Point out specific words or sounds that were pronounced well and those that need improvement. If the transcript is empty or indicates no speech, provide a score of 0 and state that no speech was detected.
    `,
    }),
});


// The Main Orchestration Flow
export const generateMonologueAnalysisFlow = ai.defineFlow(
  {
    name: 'generateMonologueAnalysisFlow',
    inputSchema: MonologueProcessingInputSchema,
    outputSchema: CombinedAnalysisOutputSchema,
  },
  async (input) => {
    const model = input.evaluationModel || 'gemini-2.5-flash';
    const prompts = createPrompt(model);

    // Step 1: Transcribe the audio
    const transcriptionResult = await withRetry(() => prompts.transcription({ studentRecordingDataUri: input.studentRecordingDataUri }));
    const studentTranscript = transcriptionResult.text;

    if (!studentTranscript || studentTranscript.trim() === "") {
        return {
            studentTranscript: '학생 답변을 인식하지 못했습니다. 마이크 상태를 확인하고 다시 시도해주세요.',
            aiFeedback: '학생의 답변이 없어 분석을 진행할 수 없습니다.',
            teacherGuidance: '학생의 답변이 없어 조언을 생성할 수 없습니다.',
            curricularRemarks: '학생의 답변이 없어 비고 작성이 불가능합니다.',
            contentScore: 0,
            pronunciationScore: 0,
            pronunciationFeedback: '학생의 음성이 없어 발음 분석을 할 수 없습니다.',
        }
    }
    
    // Step 2: Run content and pronunciation analysis in PARALLEL with retry logic.
    const [contentResult, pronunciationResult] = await Promise.all([
      withRetry(() => prompts.content({
        studentTranscript,
        activityPrompt: input.activityPrompt,
        expectedFormat: input.expectedFormat,
        studentName: input.studentName,
        assessmentTitle: input.assessmentTitle,
      })),
      withRetry(() => prompts.pronunciation({
        studentRecordingDataUri: input.studentRecordingDataUri,
        studentTranscript,
      }))
    ]);

    const contentOutput = contentResult.output;
    const pronunciationOutput = pronunciationResult.output;

    if (!contentOutput || !pronunciationOutput) {
        throw new Error("Failed to get a valid response from one or more analysis models.");
    }
    
    // Step 3: Combine and return all results to the client.
    return {
        studentTranscript,
        contentScore: contentOutput.contentScore,
        aiFeedback: contentOutput.aiFeedback,
        teacherGuidance: contentOutput.teacherGuidance,
        curricularRemarks: contentOutput.curricularRemarks || '',
        pronunciationScore: pronunciationOutput.pronunciationScore,
        pronunciationFeedback: pronunciationOutput.pronunciationFeedback,
    };
  }
);
```

--- FILE: src/ai/flows/generate-pronunciation-feedback.ts ---
```ts
// This file is obsolete and its functionality has been integrated into the new analysis flows.
// It is kept for reference but is no longer used in the application.
// The contents can be safely deleted.
```

--- FILE: src/ai/flows/generate-speaking-feedback.ts ---
```ts
'use server';

/**
 * @fileOverview Provides automated feedback on student's spoken English practice.
 *
 * - generateSpeakingFeedback - A function that generates feedback on a student's spoken English.
 * - GenerateSpeakingFeedbackInput - The input type for the generateSpeakingFeedback function.
 * - GenerateSpeakingFeedbackOutput - The return type for the generateSpeakingFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSpeakingFeedbackInputSchema = z.object({
  activityPrompt: z
    .string()
    .describe('The prompt or instructions for the speaking activity.'),
  expectedFormat: z
    .string()
    .describe('The expected format or key points of the response.'),
  studentRecordingDataUri: z
    .string()
    .describe(
      "The student's voice recording as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  studentFeedbackInstructions: z.string().describe("Instructions for generating feedback for the student."),
});

export type GenerateSpeakingFeedbackInput = z.infer<
  typeof GenerateSpeakingFeedbackInputSchema
>;

const GenerateSpeakingFeedbackOutputSchema = z.object({
  feedback: z.string().describe('The generated feedback for the student.'),
});

export type GenerateSpeakingFeedbackOutput = z.infer<
  typeof GenerateSpeakingFeedbackOutputSchema
>;

export async function generateSpeakingFeedback(
  input: GenerateSpeakingFeedbackInput
): Promise<GenerateSpeakingFeedbackOutput> {
  return generateSpeakingFeedbackFlow(input);
}

const generateSpeakingFeedbackPrompt = ai.definePrompt({
  name: 'generateSpeakingFeedbackPrompt',
  input: {schema: GenerateSpeakingFeedbackInputSchema},
  output: {schema: GenerateSpeakingFeedbackOutputSchema},
  prompt: `You are an AI assistant that provides feedback on student spoken English practice. Your response must be in Korean.

You will use information about the activity prompt, expected format, and the student's recording to provide feedback to the student.

Activity Prompt: {{{activityPrompt}}}
Expected Format: {{{expectedFormat}}}
Student Recording: {{media url=studentRecordingDataUri}}

Instructions for generating feedback for the student: {{{studentFeedbackInstructions}}}

Provide constructive criticism and specific areas for improvement in Korean.
`,
});

const generateSpeakingFeedbackFlow = ai.defineFlow(
  {
    name: 'generateSpeakingFeedbackFlow',
    inputSchema: GenerateSpeakingFeedbackInputSchema,
    outputSchema: GenerateSpeakingFeedbackOutputSchema,
  },
  async input => {
    const {output} = await generateSpeakingFeedbackPrompt(input);
    return output!;
  }
);
```

--- FILE: src/ai/flows/regenerate-curricular-remarks-flow.ts ---
```ts
'use server';
/**
 * @fileOverview A dedicated flow to regenerate only the comprehensive curricular remarks.
 *
 * - regenerateCurricularRemarks - A function that synthesizes individual remarks into one.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { ResultSummarySchema } from '@/lib/types/ai-schemas';

const RegenerateRemarksInputSchema = z.object({
  attempts: z.array(ResultSummarySchema).describe("An array of all the student's attempts, from oldest to newest."),
  assessmentTitle: z.string(),
});

const RegenerateRemarksOutputSchema = z.object({
  growthCurricularRemarks: z.string().describe("A comprehensive school record remark based on the student's entire journey."),
});
export type RegenerateRemarksOutput = z.infer<typeof RegenerateRemarksOutputSchema>;


export async function regenerateCurricularRemarks(
  input: z.infer<typeof RegenerateRemarksInputSchema>
): Promise<RegenerateRemarksOutput> {
  return regenerateCurricularRemarksFlow(input);
}


const regenerateRemarksPrompt = ai.definePrompt({
  name: 'regenerateRemarksPrompt',
  model: googleAI.model('gemini-2.5-flash'),
  input: { schema: RegenerateRemarksInputSchema.extend({ hasValidCurricularRemarks: z.boolean() }) },
  output: { schema: RegenerateRemarksOutputSchema },
  prompt: `You are an expert AI English teacher specializing in writing official school records. Your task is to synthesize a student's performance journey into a single, cohesive narrative for their school record ('생활기록부 교과 특기 사항'). Your entire response must be in Korean and formatted in formal prose, with sentences ending in '~함' or '~임'.

Assessment Title: {{{assessmentTitle}}}

Here are all the attempts from the student, in chronological order. Your primary source is the 'curricularRemarks' field from each attempt.
{{#each attempts}}
**Attempt #{{this.attemptNumber}}**
-   Content Score: {{this.contentScore}}/100
-   Pronunciation Score: {{this.pronunciationScore}}/100
-   Curricular Remarks from this attempt: "{{this.curricularRemarks}}"
---
{{/each}}


### Your Task:
{{#if hasValidCurricularRemarks}}
1.  Review the 'Curricular Remarks from this attempt' for all valid attempts provided.
2.  Synthesize these remarks into a single, cohesive narrative of about 700 Korean characters that tells the student's growth story.
3.  The final remark should start by mentioning the student's persistent effort, describe the initial performance and how it evolved with specific examples from the provided remarks, and conclude by summarizing their current demonstrated ability and attitude.
4.  Return this narrative in the 'growthCurricularRemarks' field.
{{else}}
You MUST return the exact following message in the 'growthCurricularRemarks' field: "종합 의견을 생성하기 위한 개별 시도의 교과 특기 사항 기록이 부족하거나 유효하지 않습니다."
{{/if}}
`,
});

const regenerateCurricularRemarksFlow = ai.defineFlow(
  {
    name: 'regenerateCurricularRemarksFlow',
    inputSchema: RegenerateRemarksInputSchema,
    outputSchema: RegenerateRemarksOutputSchema,
  },
  async (input) => {
    // 1. Sanitize and validate the input attempts
    const sanitizedAttempts = input.attempts.map(attempt => {
        let remarks = (attempt.curricularRemarks || "").trim();
        const isRemarkInvalid = !remarks || remarks.includes('오류') || remarks.includes('실패') || remarks.includes('없음') || remarks.includes('불가능');
        return {
          ...attempt,
          curricularRemarks: isRemarkInvalid ? null : remarks,
        };
      });

    // 2. Determine if there's any valid data to process
    const hasValidCurricularRemarks = sanitizedAttempts.some(attempt => !!attempt.curricularRemarks);
    
    // 3. Call the AI prompt with the sanitized data and validation flag
    const { output } = await regenerateRemarksPrompt({
        ...input,
        attempts: sanitizedAttempts,
        hasValidCurricularRemarks: hasValidCurricularRemarks,
    });
    
    // 4. Final safety check on the output
    const finalRemarks = output?.growthCurricularRemarks;
    if (!finalRemarks || finalRemarks.trim() === "") {
        return { growthCurricularRemarks: "오류가 발생했거나 생성된 내용이 없습니다." };
    }
    
    return { growthCurricularRemarks: finalRemarks };
  }
);
```

--- FILE: src/ai/flows/retry-analysis-flow.ts ---
```ts
'use server';
/**
 * @fileOverview A flow to retry a failed analysis using a saved recording URL.
 * 
 * - retryAnalysis - A function that takes a result ID and re-triggers the appropriate analysis flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { generateMonologueAnalysisFlow } from './generate-monologue-analysis-flow';
import { generateDialogueAnalysis } from './generate-dialogue-analysis-flow';
import { type TeacherAssessment, type StudentResult } from '@/lib/types';
import { ref, getBytes } from "firebase/storage";
import { RetryAnalysisInputSchema, type RetryAnalysisInput } from '@/lib/types/ai-schemas';

export async function retryAnalysis(input: RetryAnalysisInput): Promise<{ success: boolean; message: string }> {
  return retryAnalysisFlow(input);
}


const retryAnalysisFlow = ai.defineFlow(
  {
    name: 'retryAnalysisFlow',
    inputSchema: RetryAnalysisInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ resultId }) => {
    try {
        console.log(`[Retry Flow] Starting retry for result ID: ${resultId}`);
        const resultRef = doc(db, 'results', resultId);
        const resultSnap = await getDoc(resultRef);

        if (!resultSnap.exists()) {
            throw new Error(`Result document with ID ${resultId} not found.`);
        }

        const resultData = resultSnap.data() as StudentResult;

        if (resultData.status !== '오류') {
            return { success: false, message: 'This result is not in an error state.' };
        }
        if (!resultData.studentRecordingUrl) {
            throw new Error('Recording URL is missing, cannot retry analysis.');
        }

        const assessmentRef = doc(db, 'assessments', resultData.assessmentId);
        const assessmentSnap = await getDoc(assessmentRef);
        if (!assessmentSnap.exists()) {
            throw new Error(`Parent assessment with ID ${resultData.assessmentId} not found.`);
        }
        const assessmentData = assessmentSnap.data() as TeacherAssessment;

        // Reset status to show it's processing again
        await updateDoc(resultRef, { status: "분석 중" });
        
        // Determine which analysis flow to call based on assessment type
        if (assessmentData.assessmentType === 'dialogue') {
            // Dialogue flow is more complex and expects a full input object.
            // Note: The full conversation transcript might not be saved on initial error.
            // We will have to pass what we have. This is a limitation.
            const studentTranscript = resultData.studentTranscript || "";
            const fullTranscript = studentTranscript ? `학생: ${studentTranscript}` : "대화 기록을 복구할 수 없습니다.";

             const analysisResult = await generateDialogueAnalysis({
                studentRecordingUrl: resultData.studentRecordingUrl,
                studentTranscript: studentTranscript,
                fullConversationTranscript: fullTranscript,
                activityPrompt: assessmentData.prompt,
                expectedFormat: assessmentData.expectedFormat || "",
                studentName: resultData.name,
                assessmentTitle: assessmentData.title,
                evaluationModel: assessmentData.evaluationModel,
                useRubric: assessmentData.useRubric || false,
             });

             await updateDoc(resultRef, { ...analysisResult, status: "채점 완료" });

        } else { // Handle Monologue
            // 1. Download the file from the URL
            const storageRef = ref(storage, resultData.studentRecordingUrl);
            const audioBytes = await getBytes(storageRef);
            const audioBuffer = Buffer.from(audioBytes);

            // 2. Convert to Data URI
            const mimeType = 'audio/webm;codecs=opus'; // Assuming webm format
            const studentRecordingDataUri = `data:${mimeType};base64,${audioBuffer.toString('base64')}`;

            // 3. Call the monologue flow with the correct data format
            const analysisResult = await generateMonologueAnalysisFlow({
                studentRecordingDataUri: studentRecordingDataUri,
                activityPrompt: assessmentData.prompt,
                expectedFormat: assessmentData.expectedFormat || "",
                studentName: resultData.name,
                assessmentTitle: assessmentData.title,
                evaluationModel: assessmentData.evaluationModel,
            });

             await updateDoc(resultRef, { ...analysisResult, status: "채점 완료" });
        }

        console.log(`[Retry Flow] Successfully re-triggered analysis for ${resultId}`);
        return { success: true, message: 'Analysis retry successfully initiated.' };

    } catch (e: any) {
        console.error(`[Retry Flow] An error occurred during retry for ${resultId}:`, e);
        // Set back to error state if retry fails
        await updateDoc(doc(db, 'results', resultId), {
            status: '오류',
            aiFeedback: `재시도 실패: ${(e as Error).message || '알 수 없는 오류'}`,
        });
        throw e;
    }
  }
);
```

--- FILE: src/ai/flows/summarize-student-feedback.ts ---
```ts
'use server';

/**
 * @fileOverview Summarizes student feedback on assessment activities for teachers.
 *
 * - summarizeStudentFeedback - A function to summarize student feedback.
 * - SummarizeStudentFeedbackInput - The input type for the summarizeStudentFeedback function.
 * - SummarizeStudentFeedbackOutput - The return type for the summarizeStudentFeedback function.
 */

import {ai} from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import {z} from 'genkit';

const SummarizeStudentFeedbackInputSchema = z.object({
  feedbackText: z
    .string()
    .describe('The text of the student feedback to be summarized.'),
});
export type SummarizeStudentFeedbackInput = z.infer<
  typeof SummarizeStudentFeedbackInputSchema
>;

const SummarizeStudentFeedbackOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'A concise summary of the student feedback, highlighting key areas for improvement in evaluation content or teaching methods.'
    ),
});
export type SummarizeStudentFeedbackOutput = z.infer<
  typeof SummarizeStudentFeedbackOutputSchema
>;

export async function summarizeStudentFeedback(
  input: SummarizeStudentFeedbackInput
): Promise<SummarizeStudentFeedbackOutput> {
  return summarizeStudentFeedbackFlow(input);
}

const summarizeStudentFeedbackPrompt = ai.definePrompt({
  name: 'summarizeStudentFeedbackPrompt',
  model: googleAI.model('gemini-2.5-flash'),
  input: {schema: SummarizeStudentFeedbackInputSchema},
  output: {schema: SummarizeStudentFeedbackOutputSchema},
  prompt: `You are an AI assistant helping teachers improve their assessment activities.

  Please summarize the following student feedback, focusing on identifying areas where the evaluation content or teaching methods can be improved:

  Feedback: {{{feedbackText}}}
  `,
});

const summarizeStudentFeedbackFlow = ai.defineFlow(
  {
    name: 'summarizeStudentFeedbackFlow',
    inputSchema: SummarizeStudentFeedbackInputSchema,
    outputSchema: SummarizeStudentFeedbackOutputSchema,
  },
  async input => {
    const {output} = await summarizeStudentFeedbackPrompt(input);
    return output!;
  }
);
```

--- FILE: src/ai/flows/text-to-speech.ts ---
```ts
'use server';

/**
 * @fileOverview Converts text to speech and handles conversational AI responses.
 * Also includes a dedicated function for the Read Aloud tool.
 *
 * - converseWithStudent - A function that takes student audio, gets a conversational response, and returns AI audio.
 * - readAloudText - A function that converts a given text to speech.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';
import {
  ConverseWithStudentInput,
  ConverseWithStudentInputSchema,
  ConverseWithStudentOutput,
  ConverseWithStudentOutputSchema,
  ConversationTurnSchema,
  ReadAloudInputSchema,
  ReadAloudOutputSchema,
  type ReadAloudInput,
  type ReadAloudOutput,
} from '@/lib/types/ai-schemas';
import wav from 'wav';
import { evaluationModels } from '@/lib/types';

// Helper function for retrying API calls on overload
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error.message && (error.message.includes('overloaded') || error.message.includes('503'))) {
        console.warn(`Attempt ${i + 1} failed due to model overload. Retrying in ${delay}ms...`);
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        // Not a retryable error, throw immediately
        throw error;
      }
    }
  }
  throw lastError;
}

// Helper function to convert PCM audio buffer to WAV format
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

// Reusable function to convert text to speech
async function textToSpeech(text: string, voiceName: string = 'algenib'): Promise<string> {
    const ttsResponse = await withRetry(() => ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName as any }, 
                },
            },
        },
        prompt: text,
    }));

    const audioMedia = ttsResponse.media;
    if (!audioMedia) {
        throw new Error('TTS did not return any audio media.');
    }

    const pcmBuffer = Buffer.from(
        audioMedia.url.substring(audioMedia.url.indexOf(',') + 1),
        'base64'
    );
    
    return 'data:audio/wav;base64,' + await toWav(pcmBuffer);
}


// ====== Flow for Dialogue Assessments ======
export async function converseWithStudent(
  input: ConverseWithStudentInput
): Promise<ConverseWithStudentOutput> {
  return converseWithStudentFlow(input);
}

const createConversationalPrompt = (modelName: z.infer<typeof evaluationModels[number]>) => {
    return ai.definePrompt({
      name: `conversationalPrompt_${modelName.replace(/[-.]/g, '_')}`,
      model: googleAI.model(modelName),
      input: {
        schema: ConverseWithStudentInputSchema.pick({
          studentTranscript: true,
          scenario: true,
          scenarioPrompt: true, 
          conversationHistory: true,
          aiVoice: true,
        }).extend({
            history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
        })
      },
      output: { schema: ConverseWithStudentOutputSchema.pick({ aiResponseText: true }) },
      prompt: `You are an AI English conversation partner. Your name is "{{aiVoice}}". You are friendly, patient, and encouraging. Your goal is to have a natural, engaging conversation with a student learning English.

    IMPORTANT RULE: If the student's transcript is "(The user did not say anything)", you MUST respond by asking them to speak again, for example: "Sorry, I didn't catch that. Could you please say that again?" or "I couldn't hear you, can you repeat that?". Do not say "Okay, I see" or try to continue the conversation.

    {{#if scenario}}
    You are in a role-playing scenario. Adapt your persona and responses accordingly.
    Scenario: {{{scenario}}}
    Situation: {{#if scenarioPrompt}} {{{scenarioPrompt}}} {{else}} You are just having a friendly conversation. {{/if}}

    Based on the situation, start the conversation or respond to the student.
    {{else}}
    This is a free-talk session. Have a natural, friendly conversation.
    - Keep your responses relatively short and natural.
    - Ask questions to keep the conversation going.
    - If the student makes a grammatical error, don't correct them directly unless it significantly hinders understanding. The goal is conversation, not a grammar test.
    {{/if}}

    Conversation History (if any):
    {{#each history}}
    {{#if isUser}}Student{{else}}You{{/if}}: {{{text}}}
    {{/each}}

    {{#if studentTranscript}}
    The student's latest message is a transcript from their speech. Respond to it.
    Student: {{{studentTranscript}}}
    You:
    {{else}}
    You are starting the conversation. Greet the student according to your role and the situation. Keep it short and friendly.
    For example, if you are a shop assistant: "Hi, welcome to our store. Let me know if you need any help finding something."
    For a free talk, you could say: "Hi there! I'm {{aiVoice}}. How are you doing today?"
    You:
    {{/if}}
    `,
    });
}

const converseWithStudentFlow = ai.defineFlow(
  {
    name: 'converseWithStudentFlow',
    inputSchema: ConverseWithStudentInputSchema,
    outputSchema: ConverseWithStudentOutputSchema,
  },
  async ({ studentRecordingDataUri, conversationHistory, scenario, scenarioPrompt, aiVoice, evaluationModel }) => {
    let studentTranscript = "";
    let aiResponseText = "";
    
    // Use the faster model for real-time conversation.
    const model = 'gemini-2.5-flash-lite-preview-06-17';
    const conversationalPrompt = createConversationalPrompt(model);

    if (studentRecordingDataUri) {
      const sttResponse = await withRetry(() => ai.generate({
        model: googleAI.model(model),
        prompt: [
          { text: "Your sole task is to transcribe the provided English audio with absolute precision. Do NOT correct grammar, mispronunciations, or any other errors. Transcribe ONLY the words that are spoken. If a word is unclear, represent it as best you can phonetically. Do not add, remove, or change any words based on context or interpretation. Provide only the raw, transcribed text." },
          { media: { url: studentRecordingDataUri } },
        ],
      }));
      studentTranscript = sttResponse.text;
      if (!studentTranscript?.trim()) {
          console.warn("Transcription result was empty.");
          studentTranscript = "(The user did not say anything)"; 
      }
    }

    const historyForPrompt = conversationHistory.map(turn => ({
      ...turn,
      isUser: turn.role === 'user',
    }));

    const { output } = await withRetry(() => conversationalPrompt({
      history: historyForPrompt,
      studentTranscript: studentTranscript || undefined, 
      scenario: scenario || 'free-talk',
      scenarioPrompt: scenarioPrompt,
      conversationHistory: conversationHistory,
      aiVoice: aiVoice || 'algenib',
    }));

    aiResponseText = output?.aiResponseText || "Sorry, I'm having a little trouble right now. Could you say that again?";

    const aiResponseAudioDataUri = await textToSpeech(aiResponseText, aiVoice);

    return {
      studentTranscript: studentTranscript === "(The user did not say anything)" ? "" : studentTranscript,
      aiResponseText,
      aiResponseAudioDataUri,
    };
  }
);


// ====== Flow for Read Aloud Tool ======
export async function readAloudText(input: ReadAloudInput): Promise<ReadAloudOutput> {
    return readAloudTextFlow(input);
}

const readAloudTextFlow = ai.defineFlow(
    {
        name: 'readAloudTextFlow',
        inputSchema: ReadAloudInputSchema,
        outputSchema: ReadAloudOutputSchema,
    },
    async ({ text }) => {
        if (!text.trim()) {
            throw new Error("Cannot read empty text.");
        }
        // Using a standard, clear male voice for reading.
        const audioDataUri = await textToSpeech(text, 'puck');
        return { audioDataUri };
    }
);
```

--- FILE: src/ai/flows/transcribe-file.ts ---
```ts
'use server';

/**
 * @fileOverview A simple flow to transcribe an audio file using multiple models for comparison.
 *
 * - transcribeFile - A function that takes an audio data URI and returns transcripts from multiple models.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const TranscribeFileInputSchema = z.object({
  audioDataUri: z.string().describe(
    "An audio file as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:audio/webm;codecs=opus;base64,<encoded_data>'."
  )
});

const TranscriptionResultSchema = z.object({
  transcript: z.string().describe('The transcribed text from the audio.'),
  model: z.string().describe('The name of the model that generated this transcript.'),
});

export type TranscriptionResult = z.infer<typeof TranscriptionResultSchema>;

export async function transcribeFile(audioDataUri: string): Promise<TranscriptionResult[]> {
  const result = await transcribeFileFlow({ audioDataUri });
  return result;
}

const modelsToCompare = [
    'gemini-2.5-flash-lite-preview-06-17',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-pro',
];

const createTranscriptionPrompt = (modelName: string) => {
    return ai.definePrompt({
        name: `transcriptionPrompt_${modelName.replace(/[-.]/g, '_')}`,
        model: googleAI.model(modelName as any),
        input: { schema: TranscribeFileInputSchema },
        prompt: `Transcribe this English audio. If the audio is silent or contains no discernible speech, return an empty string.
Audio: {{media url=audioDataUri contentType='audio/webm;codecs=opus'}}
`,
    });
}


const transcribeFileFlow = ai.defineFlow(
  {
    name: 'transcribeFileFlow',
    inputSchema: TranscribeFileInputSchema,
    outputSchema: z.array(TranscriptionResultSchema),
  },
  async (input) => {
    const transcriptionPromises = modelsToCompare.map(async (modelName) => {
        try {
            const prompt = createTranscriptionPrompt(modelName);
            const { text } = await prompt(input);
            return { transcript: text || '(변환된 텍스트 없음)', model: modelName };
        } catch (error: any) {
            console.error(`Error transcribing with model ${modelName}:`, error);
            return {
                model: modelName,
                transcript: `[오류] 모델 변환에 실패했습니다: ${error.message}`
            }
        }
    });

    const results = await Promise.all(transcriptionPromises);
    return results;
  }
);
```

--- FILE: src/ai/genkit.ts ---
```ts
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
```
... I have truncated the response because it is too long. I will include all files in the final result.