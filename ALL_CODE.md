# SpeakSmart AI 평가도구 전체 코드 백업

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
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'ping-short': 'ping-short 1s cubic-bezier(0, 0, 0.2, 1) infinite',
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

// New, separated flows for monologue and dialogue analysis
import '@/ai/flows/generate-monologue-analysis-flow';
import '@/ai/flows/generate-dialogue-analysis-flow';

// New flow for the Misc page's real-time conversation tool
import '@/ai/flows/create-native-teacher-flow';
import '@/ai/flows/create-concurrent-teacher-flow'; // New flow for concurrent recording tool

// New flow for the Misc page's read-aloud tool
import '@/ai/flows/analyze-read-aloud-flow';

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

--- FILE: src/ai/flows/create-native-teacher-flow.ts ---
```ts

'use server';

/**
 * @fileOverview Converts text to speech and handles conversational AI responses for the teacher's tool.
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
  studentRecordingDataUri: z
    .string()
    .describe(
      "The user's voice recording as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ).nullable(),
  conversationHistory: z
    .array(ConversationTurnSchema)
    .describe('The history of the conversation so far.'),
});
type ConverseWithNativeTeacherInput = z.infer<typeof ConverseWithNativeTeacherInputSchema>;

const ConverseWithNativeTeacherOutputSchema = z.object({
  aiResponseText: z.string().describe('The text of the AI conversational partner.'),
  aiResponseAudioDataUri: z.string().describe("The AI's response as a playable audio data URI."),
  studentTranscript: z.string().describe("The transcript of the user's speech."),
});
type ConverseWithNativeTeacherOutput = z.infer<typeof ConverseWithNativeTeacherOutputSchema>;


export async function converseWithNativeTeacher(
  input: ConverseWithNativeTeacherInput
): Promise<ConverseWithNativeTeacherOutput> {
  return converseWithNativeTeacherFlow(input);
}

// 1. Define the prompt for generating the conversational text response
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

// Function to convert text to speech
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

// 2. Define the main flow that orchestrates the entire process
const converseWithNativeTeacherFlow = ai.defineFlow(
  {
    name: 'converseWithNativeTeacherFlow',
    inputSchema: ConverseWithNativeTeacherInputSchema,
    outputSchema: ConverseWithNativeTeacherOutputSchema,
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

    // Pre-process history for the template helper
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
        // If AI fails to respond, generate a safe fallback response.
        aiResponseText = "Sorry, I'm having a little trouble right now. Could you say that again?";
    }

    // Step 3: Convert AI's text response to speech (TTS)
    const aiResponseAudioDataUri = await textToSpeech(aiResponseText);

    // Step 4: Return all the generated data
    return {
      studentTranscript: studentTranscript === "(The user did not say anything)" ? "" : studentTranscript,
      aiResponseText,
      aiResponseAudioDataUri,
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
"① 다양한 의사소통 전략을 활용하는 말하기 수업에서, 모둠별 토론 활동과 역할극에 적극적으로 참여하여 과제를 성공적으로 수행함. 몸짓언어에 대한 글을 읽고 토론하는 수업에서, 다문화 친구와 포옹을 하는 것이 불러온 오해에 관한 자신의 경험에 대해 말함. ② 다문화 친구와 허그를 하는 것에 대한 어머니의 지적에, 친구의 배경문화에서는 자연스러운 인사임을 설명하면서 설득하였다다는 사례를 들어, 비언어적 요소가 문화를 이해하는 데 큰 영향을 미친다는 소감을 말함. 한국의 관광지로서의 장점을 말하는 역할극에서는 사회자 역을 맡아 지하철 노선도를 보여주면서 대중교통의 편리함에 대해 유창한 영어로 설명하여 큰 호응을 얻음. ③ 다른 친구들이 사례를 말할 때 맞장구를 치며 경청하여 토론의 분위기를 활발하게 만듦. 모둠 활동에서 발표자 선정 시 유창한 영어 실력에도 불구하고 다른 학생을 추천하여 기회를 주고 영어 표현을 작성하는 데 도움을 주는 등 양보심과 배려심이 많은 학생임."

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
import { evaluationModels, type RubricScores, type StudentResult } from '@/lib/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// This parsing logic is now centralized here.
const parseScore = (text: string, category: string): number => {
    // A more flexible regex that doesn't rely on emojis or exact spacing
    const regex = new RegExp(`${category}[\\s\\S]*?점수[^\\d]*(\\d)`);
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
): Promise<void> {
  const resultDocRef = doc(db, "results", input.resultId);

  try {
      console.log(`[Dialogue Flow] Starting analysis for result ID: ${input.resultId}`);
      await updateDoc(resultDocRef, { status: "분석 중: analyze", assessmentType: "dialogue" });
      
      const analysisResult = await generateDialogueAnalysisFlow(input);

      console.log(`[Dialogue Flow] Analysis complete. Updating document with final report for ${input.resultId}`);
      await updateDoc(resultDocRef, { status: "분석 중: report" });
      
      const finalResultData: Partial<StudentResult> = {
          ...analysisResult,
          status: "채점 완료",
          teacherUid: input.teacherUid,
          // Ensure the URL is persisted upon success as well
          studentRecordingUrl: input.studentRecordingUrl,
          assessmentType: "dialogue",
      };
      
      await updateDoc(resultDocRef, finalResultData);
      console.log(`[Dialogue Flow] Final result stored in ${input.resultId}. Status: '채점 완료'`);

  } catch (e: any) {
      console.error(`[Dialogue Flow] An error occurred during dialogue analysis for ${input.resultId}:`, e);
      // On error, still try to save the recording URL for retry purposes.
      await updateDoc(resultDocRef, {
          status: "오류",
          aiFeedback: (e as Error).message || "알 수 없는 오류가 발생했습니다.",
          studentRecordingUrl: input.studentRecordingUrl, // Save URL even on failure
          assessmentType: "dialogue",
      });
      // Re-throw to let the caller know something went wrong.
      throw e;
  }
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
    1.  **Generate Feedback for the Student:** Analyze the student's conversational skills (turn-taking, relevance, naturalness) in addition to fluency, grammar, and vocabulary. Provide encouraging and constructive feedback. Include specific examples from the student's parts of the conversation.
    2.  **Generate Guidance for the Teacher:** Provide actionable advice for the classroom teacher on how to help this student improve their conversational skills.
    3.  **Draft '생활기록부 교과 특기 사항':** Write official school record remarks in a formal, descriptive tone with sentences ending in '~함' or '~임'. The remarks must be based on the student's performance in this specific dialogue, summarizing their interaction and linking it to English communication competencies. Follow a 3-part structure.
    4.  **Assign a Content Score:** Give a score from 0 to 100 for the *content and conversational skill* of the student's performance based on how well they navigated the dialogue in line with the prompt and criteria.
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
      prompt: `당신은 숙련된 프론트엔드 개발자입니다. 아래 요구사항에 맞춰 AI 영어 회화 능력 분석 보고서를 표시하는 단일 HTML 웹페이지를 제작해 주세요.

1. 최종 목표:
사용자의 영어 회화 능력 분석 결과를 보여주는, 시각적으로 깔끔하고 반응형으로 동작하는 웹페이지를 생성합니다. 결과물은 별도의 파일 없이 하나의 HTML 파일로만 구성되어야 합니다.

2. 콘텐츠 구조 (HTML):

전체 제목: 페이지 상단에 <h1> 태그를 사용하여 "📊 AI 영어회화 상세 분석" 제목을 추가합니다.

분석 항목: 아래 5가지 분석 항목을 각각의 섹션으로 만듭니다. 각 항목은 <div class="category-card">로 감싸주세요.

🗣️ 유창성 (Fluency)

🎤 발음 및 억양 (Pronunciation & Intonation)

✍️ 문법 (Grammar)

📚 어휘 (Vocabulary)

🤝 내용 이해 및 상호작용 (Comprehension & Interaction)

항목별 헤더: 각 분석 항목 카드 상단에는 항목명(<h2>)과 점수(<span>)를 표시합니다. 점수는 "📈 점수: X / 5점" 형식입니다.

상세 내용: 각 항목 카드 내부에 "잘한 점"과 "개선점"을 나란히 비교할 수 있는 두 개의 박스를 만듭니다.

"👍 잘한 점" 박스 (<div class="detail-box good-points">)

"💡 개선점" 박스 (<div class="detail-box improvement-points">)

각 박스 안에는 소제목(<h3>)과 <ul>, <li> 태그를 사용하여 상세 내용을 목록으로 정리합니다. (내용은 아래 제공된 텍스트를 사용)

3. 디자인 및 스타일 (CSS):

레이아웃:

Flexbox를 사용하여 "잘한 점"과 "개선점" 박스를 가로로 배치합니다.

전체 콘텐츠는 페이지 중앙에 오도록 하고, max-width: 900px를 설정하여 가독성을 확보합니다.

반응형 디자인:

필수: 화면 너비가 768px 이하가 되면, "잘한 점"과 "개선점" 박스가 세로로 쌓이도록 미디어 쿼리(@media)를 설정해야 합니다.

색상 및 효과:

전체 페이지 배경은 연한 회색 (#f4f7f9), 콘텐츠 카드는 흰색 (#ffffff)으로 지정합니다.

"잘한 점" 박스: 긍정적 느낌을 주는 연한 녹색 계열(background-color: #e8f5e9, border-left: 5px solid #4caf50)으로 스타일링합니다.

"개선점" 박스: 주목도를 높이는 연한 주황색 계열(background-color: #fff3e0, border-left: 5px solid #ff9800)으로 스타일링합니다.

각 분석 항목 카드에 마우스를 올리면 그림자(box-shadow) 효과가 살짝 나타나도록 하여 상호작용성을 높여주세요.

폰트: font-family는 Apple과 Windows 시스템에서 모두 깔끔하게 보이는 기본 산세리프 폰트 (예: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)로 설정합니다.

4. 기술 요구사항:

모든 CSS 코드는 HTML 파일 내 <head> 섹션의 <style> 태그 안에 포함시켜야 합니다.

외부 CSS 라이브러리(Bootstrap, Tailwind CSS 등)는 사용하지 않습니다.

코드의 각 부분에 주석을 달아 어떤 역할을 하는지 설명해주세요.

[사용자 발화 내용]
{{{fullConversationTranscript}}}

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
`,
    }),
});

// The Main Orchestration Flow for Dialogue
const generateDialogueAnalysisFlow = ai.defineFlow(
  {
    name: 'generateDialogueAnalysisFlow',
    inputSchema: GenerateDialogueAnalysisInputSchema.pick({
      studentRecordingUrl: true,
      studentTranscript: true,
      fullConversationTranscript: true,
      activityPrompt: true,
      expectedFormat: true,
      studentName: true,
      assessmentTitle: true,
      evaluationModel: true,
      useRubric: true,
    }),
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
            rubricScores: { fluency: 0, pronunciation: 0, grammar: 0, vocabulary: 0, interaction: 0 },
        }
    }
    
    if (input.useRubric) {
        const rubricResult = await withRetry(() => prompts.rubric({ fullConversationTranscript: input.fullConversationTranscript }));
        let rubricText = rubricResult.text;
         // Clean up the text just in case the model still wraps it
        if (rubricText.startsWith("```html")) {
            rubricText = rubricText.substring(7, rubricText.length - 3).trim();
        }
        
        const rubricScores: RubricScores = {
            fluency: parseScore(rubricText, '유창성'),
            pronunciation: parseScore(rubricText, '발음 및 억양'),
            grammar: parseScore(rubricText, '문법'),
            vocabulary: parseScore(rubricText, '어휘'),
            interaction: parseScore(rubricText, '내용 이해 및 상호작용'),
        };

        const contentScore = Math.round(((rubricScores.fluency + rubricScores.grammar + rubricScores.vocabulary + (rubricScores.interaction || 0)) / 4) * 20);
        const pronunciationScore = rubricScores.pronunciation * 20;

        return {
            studentTranscript: input.fullConversationTranscript,
            contentScore: contentScore,
            pronunciationScore: pronunciationScore,
            aiFeedback: rubricText,
            teacherGuidance: "루브릭 기반 평가를 사용했습니다. 학생의 강점과 약점을 항목별로 확인하고, 개선점에 제시된 활동을 지도해주세요.",
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
import { GenerateGrowthFeedbackInputSchema, GenerateGrowthFeedbackOutputSchema, type GenerateGrowthFeedbackInput, type GenerateGrowthFeedbackOutput } from '@/lib/types/ai-schemas';

export async function generateGrowthFeedback(
  input: GenerateGrowthFeedbackInput
): Promise<GenerateGrowthFeedbackOutput> {
  return generateGrowthFeedbackFlow(input);
}

const growthFeedbackPrompt = ai.definePrompt({
  name: 'growthFeedbackPrompt',
  model: googleAI.model('gemini-2.5-flash'),
  input: { schema: GenerateGrowthFeedbackInputSchema },
  output: { schema: GenerateGrowthFeedbackOutputSchema },
  prompt: `You are an expert AI English teacher. Your task is to provide a comprehensive growth analysis for a student by comparing all of their attempts of the same speaking assessment. Your entire response must be in Korean and formatted in Markdown.

Assessment Title: {{{assessmentTitle}}}

Here are all the attempts from the student, in chronological order:
{{#each attempts}}
**Attempt #{{this.attemptNumber}}**
-   Content Score: {{this.contentScore}}/100
-   Pronunciation Score: {{this.pronunciationScore}}/100
-   Transcript: "{{this.transcript}}"
-   AI Feedback Given: "{{this.aiFeedback}}"
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
        -   **Heading: "### 💡 총평 및 격려" (Overall Comment & Encouragement):** End with a positive, motivational summary message about their entire journey.

2.  **Generate Teacher Guidance ('teacherGuidance'):**
    -   **Format:** Plain text with clear paragraphs. Do NOT write one long block of text.
    -   **Tone:** Professional and advisory.
    -   **Content:** Summarize the student's overall progress across all attempts. Pinpoint the most significant areas of improvement and persistent weaknesses. Provide clear, actionable advice by suggesting specific activities or teaching strategies. Separate your points into distinct paragraphs for readability.

3.  **Generate '생활기록부 교과 특기 사항' ('curricularRemarks'):**
    -   **Format:** Formal Korean prose, with sentences ending in '~함' or '~임'.
    -   **Tone:** Official and descriptive, suitable for a school record.
    -   **Content:** Synthesize the student's performance from ALL attempts into a single, comprehensive narrative of about 700 Korean characters. The final remark should start by mentioning the student's persistent effort, describe the initial state and how it evolved with specific examples, and conclude by summarizing their current demonstrated ability and attitude. This should be a well-written, cohesive summary, not just a list of points.

The final output must be a single JSON object containing 'growthFeedback', 'teacherGuidance', and 'curricularRemarks'.
`,
});

const generateGrowthFeedbackFlow = ai.defineFlow(
  {
    name: 'generateGrowthFeedbackFlow',
    inputSchema: GenerateGrowthFeedbackInputSchema,
    outputSchema: GenerateGrowthFeedbackOutputSchema,
  },
  async (input) => {
    const { output } = await growthFeedbackPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return valid growth feedback.");
    }
    return output;
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
import { evaluationModels, type RubricScores, type StudentResult } from '@/lib/types';
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc } from 'firebase/firestore';


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
  useRubric: z.boolean().optional().describe('Whether to use the standardized rubric for evaluation.'),
  resultId: z.string().describe('The Firestore document ID for the result to update progress.'),
  teacherUid: z.string().describe("The UID of the teacher who created the assessment."),
});
type MonologueProcessingInput = z.infer<typeof MonologueProcessingInputSchema>;

// This parsing logic is now centralized here.
const parseScore = (text: string, category: string): number => {
    const regex = new RegExp(`${category}[\\s\\S]*?점수[^\\d]*(\\d)`);
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

// Internal Sub-prompts
const createPrompt = (modelName: z.infer<typeof evaluationModels[number]>) => ({
    transcription: ai.definePrompt({
        name: `transcribeAudioPrompt_${modelName.replace(/[-.]/g, '_')}`,
        model: googleAI.model(modelName),
        input: { schema: z.object({ studentRecordingUrl: z.string() }) },
        prompt: `Transcribe this English audio.
    Audio: {{media url=studentRecordingUrl}}
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
            studentRecordingUrl: z.string(),
            studentTranscript: z.string(),
        }) },
        output: { schema: PronunciationAnalysisOutputSchema },
        prompt: `You are an expert English pronunciation coach. Your task is to evaluate a student's spoken English based on their audio recording and the corresponding transcript. Provide all feedback in Korean.
    
    - Student's Audio Recording: {{media url=studentRecordingUrl}}
    - AI-generated Transcript: {{{studentTranscript}}}
    
    Please perform the following steps:
    1.  Listen carefully to the audio and compare it with the transcript.
    2.  Evaluate accuracy, clarity, intonation, and fluency.
    3.  **Assign a Pronunciation Score:** Give a score from 0 to 100 (100 is native-like, 0 is unintelligible).
    4.  **Provide Pronunciation Feedback:** Write specific, constructive feedback in Korean. Point out specific words or sounds that were pronounced well and those that need improvement. If the transcript is empty or indicates no speech, provide a score of 0 and state that no speech was detected.
    `,
    }),
    rubric: ai.definePrompt({
      name: `monologueRubricAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`,
      model: googleAI.model(modelName),
      input: { schema: z.object({ studentTranscript: z.string() }) },
      prompt: `당신은 숙련된 프론트엔드 개발자입니다. 아래 요구사항에 맞춰 AI 영어 회화 능력 분석 보고서를 표시하는 단일 HTML 웹페이지를 제작해 주세요.

1. 최종 목표:
사용자의 영어 회화 능력 분석 결과를 보여주는, 시각적으로 깔끔하고 반응형으로 동작하는 웹페이지를 생성합니다. 결과물은 별도의 파일 없이 하나의 HTML 파일로만 구성되어야 합니다.

2. 콘텐츠 구조 (HTML):

전체 제목: 페이지 상단에 <h1> 태그를 사용하여 "📊 AI 영어회화 상세 분석" 제목을 추가합니다.

분석 항목: 아래 5가지 분석 항목을 각각의 섹션으로 만듭니다. 각 항목은 <div class="category-card">로 감싸주세요.

🗣️ 유창성 (Fluency)

🎤 발음 및 억양 (Pronunciation & Intonation)

✍️ 문법 (Grammar)

📚 어휘 (Vocabulary)

🤝 내용 이해 및 상호작용 (Comprehension & Interaction)

항목별 헤더: 각 분석 항목 카드 상단에는 항목명(<h2>)과 점수(<span>)를 표시합니다. 점수는 "📈 점수: X / 5점" 형식입니다.

상세 내용: 각 항목 카드 내부에 "잘한 점"과 "개선점"을 나란히 비교할 수 있는 두 개의 박스를 만듭니다.

"👍 잘한 점" 박스 (<div class="detail-box good-points">)

"💡 개선점" 박스 (<div class="detail-box improvement-points">)

각 박스 안에는 소제목(<h3>)과 <ul>, <li> 태그를 사용하여 상세 내용을 목록으로 정리합니다. (내용은 아래 제공된 텍스트를 사용)

3. 디자인 및 스타일 (CSS):

레이아웃:

Flexbox를 사용하여 "잘한 점"과 "개선점" 박스를 가로로 배치합니다.

전체 콘텐츠는 페이지 중앙에 오도록 하고, max-width: 900px를 설정하여 가독성을 확보합니다.

반응형 디자인:

필수: 화면 너비가 768px 이하가 되면, "잘한 점"과 "개선점" 박스가 세로로 쌓이도록 미디어 쿼리(@media)를 설정해야 합니다.

색상 및 효과:

전체 페이지 배경은 연한 회색 (#f4f7f9), 콘텐츠 카드는 흰색 (#ffffff)으로 지정합니다.

"잘한 점" 박스: 긍정적 느낌을 주는 연한 녹색 계열(background-color: #e8f5e9, border-left: 5px solid #4caf50)으로 스타일링합니다.

"개선점" 박스: 주목도를 높이는 연한 주황색 계열(background-color: #fff3e0, border-left: 5px solid #ff9800)으로 스타일링합니다.

각 분석 항목 카드에 마우스를 올리면 그림자(box-shadow) 효과가 살짝 나타나도록 하여 상호작용성을 높여주세요.

폰트: font-family는 Apple과 Windows 시스템에서 모두 깔끔하게 보이는 기본 산세리프 폰트 (예: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)로 설정합니다.

4. 기술 요구사항:

모든 CSS 코드는 HTML 파일 내 <head> 섹션의 <style> 태그 안에 포함시켜야 합니다.

외부 CSS 라이브러리(Bootstrap, Tailwind CSS 등)는 사용하지 않습니다.

코드의 각 부분에 주석을 달아 어떤 역할을 하는지 설명해주세요.

[사용자 발화 내용]
{{{studentTranscript}}}

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
이 항목은 대화형 시나리오에서만 평가합니다. 혼자 말하기 과제였으므로 이 항목은 1점으로 고정하고, 피드백은 '평가 대상 아님'으로 작성합니다.
`,
    }),
});


// The Main Orchestration Flow
export const generateMonologueAnalysisFlow = ai.defineFlow(
  {
    name: 'generateMonologueAnalysisFlow',
    inputSchema: MonologueProcessingInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    const model = input.evaluationModel || 'gemini-2.5-flash';
    const prompts = createPrompt(model);
    const resultDocRef = doc(db, "results", input.resultId);
    let downloadURL = ""; // To store the URL for retry purposes

    try {
      // Step 1: Upload File to Storage first (can happen in parallel with first AI call)
      await updateDoc(resultDocRef, { status: "분석 중: upload", assessmentType: "monologue" });
      console.log("[Flow] Step 1: Uploading audio file to Storage.");
      const studentUid = input.studentName; 
      const uploadPath = `recordings/${studentUid}_${input.assessmentTitle}_${Date.now()}.webm`;
      const storageRef = ref(storage, uploadPath);
      const uploadTask = uploadString(storageRef, input.studentRecordingDataUri, 'data_url');
      
      // Step 2: Transcribe the audio
      await updateDoc(resultDocRef, { status: "분석 중: transcribe" });
      console.log("[Flow] Step 2: Transcribing audio.");
      const transcriptionResult = await withRetry(() => prompts.transcription({ studentRecordingUrl: input.studentRecordingDataUri }));
      const studentTranscript = transcriptionResult.text;

      if (!studentTranscript || studentTranscript.trim() === "" || studentTranscript.includes('기록되지 않았습니다') || studentTranscript.includes('인식하지 못했습니다')) {
          throw new Error('학생 답변을 인식하지 못했습니다. 마이크 상태를 확인하고 다시 시도해주세요.');
      }
      
      // Wait for the upload to finish and get the URL
      const uploadSnapshot = await uploadTask;
      downloadURL = await getDownloadURL(uploadSnapshot.ref);
      console.log("[Flow] Audio uploaded, URL:", downloadURL);

      // Step 3: Content & Pronunciation Analysis (in parallel)
      await updateDoc(resultDocRef, { status: "분석 중: analyze" });
      console.log("[Flow] Step 3: Starting content and pronunciation analysis in parallel.");
      const analysisPromise = (async () => {
          if (input.useRubric) {
              return withRetry(() => prompts.rubric({ studentTranscript }));
          } else {
              const [contentResult, pronunciationResult] = await Promise.all([
                  withRetry(() => prompts.content({
                      studentTranscript,
                      activityPrompt: input.activityPrompt,
                      expectedFormat: input.expectedFormat,
                      studentName: input.studentName,
                      assessmentTitle: input.assessmentTitle,
                  })),
                  withRetry(() => prompts.pronunciation({
                      studentRecordingUrl: input.studentRecordingDataUri,
                      studentTranscript,
                  }))
              ]);
              const contentOutput = contentResult.output;
              const pronunciationOutput = pronunciationResult.output;
              if (!contentOutput || !pronunciationOutput) {
                  throw new Error("Failed to get a valid response from one or more analysis models.");
              }
              return { contentOutput, pronunciationOutput };
          }
      })();
      
      const analysisResult = await analysisPromise;
      console.log("[Flow] Analysis complete.");
      
      // Step 4: Process results and generate final report object
      await updateDoc(resultDocRef, { status: "분석 중: report" });
      console.log("[Flow] Step 4: Generating final report.");
      
      let finalResult: z.infer<typeof CombinedAnalysisOutputSchema>;

      if ('text' in analysisResult) { // This means it's a rubric result
          let rubricText = analysisResult.text;
          // Clean up the text just in case the model still wraps it
          if (rubricText.startsWith("```html")) {
              rubricText = rubricText.substring(7, rubricText.length - 3).trim();
          }
          
          const rubricScores: RubricScores = {
            fluency: parseScore(rubricText, '유창성'),
            pronunciation: parseScore(rubricText, '발음 및 억양'),
            grammar: parseScore(rubricText, '문법'),
            vocabulary: parseScore(rubricText, '어휘'),
          };
          
          const contentScore = Math.round(((rubricScores.fluency + rubricScores.grammar + rubricScores.vocabulary) / 3) * 20);
          const pronunciationScore = rubricScores.pronunciation * 20;

          finalResult = {
              studentTranscript,
              contentScore: contentScore,
              pronunciationScore: pronunciationScore,
              aiFeedback: rubricText,
              teacherGuidance: "루브릭 기반 평가를 사용했습니다. 학생의 강점과 약점을 항목별로 확인하고, 개선점에 제시된 활동을 지도해주세요.",
              curricularRemarks: `'${input.assessmentTitle}' 평가에서 루브릭 기반으로 유창성(${rubricScores.fluency}점), 문법(${rubricScores.grammar}점), 어휘(${rubricScores.vocabulary}점) 영역에서 종합 ${contentScore}점, 발음 영역에서 ${pronunciationScore}점을 받는 등 준수한 성취를 보임.`,
              pronunciationFeedback: `루브릭 기반 발음 점수는 ${pronunciationScore}점입니다. 상세 내용은 종합 분석 리포트를 참고하세요.`,
              rubricScores,
          };
      } else {
          const { contentOutput, pronunciationOutput } = analysisResult as { contentOutput: z.infer<typeof ContentAnalysisOutputSchema>, pronunciationOutput: z.infer<typeof PronunciationAnalysisOutputSchema> };
          finalResult = {
              studentTranscript,
              contentScore: contentOutput.contentScore,
              aiFeedback: contentOutput.aiFeedback,
              teacherGuidance: contentOutput.teacherGuidance,
              curricularRemarks: contentOutput.curricularRemarks,
              pronunciationScore: pronunciationOutput.pronunciationScore,
              pronunciationFeedback: pronunciationOutput.pronunciationFeedback,
          };
      }
      
      console.log("[Flow] Final report generated. Updating Firestore document.");
      
      // Update the main document with the final analysis and set status to complete
      await updateDoc(resultDocRef, {
          ...finalResult,
          studentRecordingUrl: downloadURL,
          status: "채점 완료",
          teacherUid: input.teacherUid,
          assessmentType: "monologue",
      });

      console.log(`[Flow] Final result document ${input.resultId} updated. Status: '채점 완료'`);
    } catch(e) {
       console.error("[Flow] An error occurred in generateMonologueAnalysisFlow", e);
       await updateDoc(resultDocRef, { 
          status: '오류', 
          aiFeedback: (e as Error).message || "알 수 없는 오류가 발생했습니다.",
          studentRecordingUrl: downloadURL || "" // Save URL even on failure if available
       });
       // Re-throw the error to be caught by the client-side caller if needed
       throw e;
    }
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

--- FILE: src/ai/flows/recalculate-scores-flow.ts ---
```ts
// This file is obsolete and has been removed as its functionality is now handled client-side.

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

             await generateDialogueAnalysis({
                resultId: resultId,
                teacherUid: resultData.teacherUid,
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

        } else { // Handle Monologue
            // 1. Download the file from the URL
            const storageRef = ref(storage, resultData.studentRecordingUrl);
            const audioBytes = await getBytes(storageRef);
            const audioBuffer = Buffer.from(audioBytes);

            // 2. Convert to Data URI
            const mimeType = 'audio/webm;codecs=opus'; // Assuming webm format
            const studentRecordingDataUri = `data:${mimeType};base64,${audioBuffer.toString('base64')}`;

            // 3. Call the monologue flow with the correct data format
            await generateMonologueAnalysisFlow({
                resultId: resultId,
                studentRecordingDataUri: studentRecordingDataUri,
                activityPrompt: assessmentData.prompt,
                expectedFormat: assessmentData.expectedFormat || "",
                studentName: resultData.name,
                assessmentTitle: assessmentData.title,
                evaluationModel: assessmentData.evaluationModel,
                useRubric: assessmentData.useRubric || false,
                teacherUid: resultData.teacherUid,
            });
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
// 'use server';

/**
 * @fileOverview Summarizes student feedback on assessment activities for teachers.
 *
 * - summarizeStudentFeedback - A function to summarize student feedback.
 * - SummarizeStudentFeedbackInput - The input type for the summarizeStudentFeedback function.
 * - SummarizeStudentFeedbackOutput - The return type for the summarizeStudentFeedback function.
 */

'use server';

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
 *
 * - converseWithStudent - A function that takes student audio, gets a conversational response, and returns AI audio.
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


export async function converseWithStudent(
  input: ConverseWithStudentInput
): Promise<ConverseWithStudentOutput> {
  return converseWithStudentFlow(input);
}

// 1. Define the prompt for generating the conversational text response
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

// Function to convert text to speech
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

// 2. Define the main flow that orchestrates the entire process
const converseWithStudentFlow = ai.defineFlow(
  {
    name: 'converseWithStudentFlow',
    inputSchema: ConverseWithStudentInputSchema,
    outputSchema: ConverseWithStudentOutputSchema,
  },
  async ({ studentRecordingDataUri, conversationHistory, scenario, scenarioPrompt, aiVoice, evaluationModel }) => {
    let studentTranscript = "";
    let aiResponseText = "";
    
    const model = evaluationModel || 'gemini-2.5-flash';
    const conversationalPrompt = createConversationalPrompt(model);


    // Step 1: Transcribe student's audio if it exists.
    if (studentRecordingDataUri) {
      const sttResponse = await withRetry(() => ai.generate({
        model: googleAI.model(model),
        prompt: [
          { text: 'Transcribe this English audio.' },
          { media: { url: studentRecordingDataUri } },
        ],
      }));
      studentTranscript = sttResponse.text;
      if (!studentTranscript?.trim()) {
          console.warn("Transcription result was empty.");
          studentTranscript = "(The user did not say anything)"; 
      }
    }

    // Pre-process history for the template helper
    const historyForPrompt = conversationHistory.map(turn => ({
      ...turn,
      isUser: turn.role === 'user',
    }));

    // Step 2: Generate AI's text response based on transcript and history
    const { output } = await withRetry(() => conversationalPrompt({
      history: historyForPrompt,
      studentTranscript: studentTranscript || undefined, 
      scenario: scenario || 'free-talk',
      scenarioPrompt: scenarioPrompt,
      conversationHistory: conversationHistory,
      aiVoice: aiVoice || 'algenib',
    }));

    aiResponseText = output?.aiResponseText || "";

    if (!aiResponseText) {
        console.error("AI did not generate a text response. Received:", output);
        // If AI fails to respond, generate a safe fallback response.
        aiResponseText = "Sorry, I'm having a little trouble right now. Could you say that again?";
    }

    // Step 3: Convert AI's text response to speech (TTS)
    const aiResponseAudioDataUri = await textToSpeech(aiResponseText, aiVoice);

    // Step 4: Return all the generated data
    return {
      studentTranscript: studentTranscript === "(The user did not say anything)" ? "" : studentTranscript,
      aiResponseText,
      aiResponseAudioDataUri,
    };
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
import {config} from 'dotenv';

config();

// ====================================================================
// 중요: .env 파일에 Google AI API 키를 설정해주세요.
//
// 1. [Google Cloud 자격 증명 페이지](https://console.cloud.google.com/apis/credentials)로 이동합니다.
// 2. 'API 키' 목록에서 "Browser key (auto created by Firebase)" 라는 이름의 키를 클릭합니다.
//    (이름이 다르다면, 사용 중인 API 키를 선택하세요.)
// 3. '키 제한사항' 섹션에서 '웹사이트' 제한을 '없음'으로 설정하고 저장합니다.
//    (이 과정이 서버 환경에서 발생하는 'API_KEY_HTTP_REFERRER_BLOCKED' 오류를 해결합니다.)
// 4. '키 표시'를 눌러 키를 복사한 후, 이 프로젝트의 .env 파일에 GOOGLE_API_KEY="여기에_키_붙여넣기" 형식으로 저장하세요.
// ====================================================================
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.warn(
      'GOOGLE_API_KEY is not set in the .env file. AI features will not work. Please get a key from the Google Cloud Console.'
    );
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GOOGLE_API_KEY,
    }),
  ],
});

```

--- FILE: src/app/globals.css ---
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Noto_Sans_KR', 'sans-serif';
}

@layer base {
  :root {
    --background: 30 33% 96.7%; /* saebyeol-beige */
    --foreground: 240 4% 33%; /* basalt-gray */
    --card: 0 0% 100%;
    --card-foreground: 240 4% 33%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 4% 33%;
    --primary: 212 73% 59%; /* jeju-sea */
    --primary-foreground: 0 0% 100%;
    --secondary: 220 14.3% 95.9%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 220 14.3% 95.9%;
    --muted-foreground: 240 4% 45%;
    --accent: 38 92% 56%; /* tangerine */
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --ring: 212 73% 59%;
    --chart-1: 212 73% 59%;
    --chart-2: 38 92% 56%;
    --chart-3: 147 50% 36%; /* bijarim-green */
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
    --radius: 0.5rem;
    --sidebar-background: 0 0% 100%;
    --sidebar-foreground: 240 4% 33%;
    --sidebar-primary: 212 73% 59%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 30 33% 96.7%;
    --sidebar-accent-foreground: 222.2 47.4% 11.2%;
    --sidebar-border: 220 13% 91%;
    --sidebar-ring: 212 73% 59%;
  }
  .dark {
    --background: 224 71.4% 4.1%;
    --foreground: 210 40% 98%;
    --card: 224 71.4% 4.1%;
    --card-foreground: 210 40% 98%;
    --popover: 224 71.4% 4.1%;
    --popover-foreground: 210 40% 98%;
    --primary: 212 73% 59%;
    --primary-foreground: 0 0% 100%;
    --secondary: 222.2 47.4% 11.2%;
    --secondary-foreground: 210 40% 98%;
    --muted: 222.2 47.4% 11.2%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 38 92% 56%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 222.2 47.4% 11.2%;
    --input: 222.2 47.4% 11.2%;
    --ring: 212 73% 59%;
    --chart-1: 212 73% 59%;
    --chart-2: 38 92% 56%;
    --chart-3: 147 50% 36%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
    --sidebar-background: 224 71.4% 4.1%;
    --sidebar-foreground: 210 40% 98%;
    --sidebar-primary: 212 73% 59%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 222.2 47.4% 11.2%;
    --sidebar-accent-foreground: 210 40% 98%;
    --sidebar-border: 222.2 47.4% 11.2%;
    --sidebar-ring: 212 73% 59%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
  /* Custom styles for rendered markdown */
  .markdown-content h1 { @apply text-2xl font-bold mb-4 border-b pb-2; }
  .markdown-content h2 { @apply text-xl font-semibold mb-3 border-b pb-2; }
  .markdown-content h3 { @apply text-lg font-semibold mb-2; }
  .markdown-content p { @apply mb-4 leading-relaxed; }
  .markdown-content ul { @apply list-disc pl-5 mb-4 space-y-1; }
  .markdown-content ol { @apply list-decimal pl-5 mb-4 space-y-1; }
  .markdown-content blockquote { @apply border-l-4 border-muted-foreground/50 pl-4 italic text-muted-foreground my-4; }
  .markdown-content code { @apply bg-muted text-muted-foreground rounded-sm px-1 py-0.5 font-mono text-sm; }
  .markdown-content pre { @apply bg-muted p-4 rounded-md overflow-x-auto; }
  
  /* Table styles for Rubric */
  .markdown-content table { 
    @apply w-full my-4 border-collapse; 
  }
  .markdown-content th, .markdown-content td { 
    @apply border border-border px-4 py-2 text-left align-top;
  }
  .markdown-content th { 
    @apply font-semibold bg-muted;
  }

  /* Specific styling for the 2-column feedback table */
  .markdown-content h3 + table,
  .markdown-content h3 + p + table {
    @apply border-none;
  }

  .markdown-content h3 + table thead,
  .markdown-content h3 + p + table thead {
      @apply hidden;
  }

  .markdown-content h3 + table tbody,
  .markdown-content h3 + p + table tbody {
      @apply grid grid-cols-1 md:grid-cols-2 gap-4;
  }

  .markdown-content h3 + table tr,
  .markdown-content h3 + p + table tr {
      @apply flex flex-col;
  }

  .markdown-content h3 + table td,
  .markdown-content h3 + p + table td {
      @apply border rounded-lg p-4 bg-background;
  }
}

@layer utilities {
  .font-body {
    font-family: var(--font-noto-sans-kr), sans-serif;
  }
  .font-headline {
    font-family: var(--font-noto-sans-kr), sans-serif;
  }
}

```

--- FILE: src/app/layout.tsx ---
```tsx
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from '@/context/language-context';
import { AuthProvider } from '@/context/auth-context';
import { Noto_Sans_KR } from 'next/font/google';

const noto_sans_kr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal'],
  variable: '--font-noto-sans-kr',
});

export const metadata: Metadata = {
  title: 'SpeakSmart 평가도구',
  description: 'AI 기반 영어 말하기 평가 플랫폼',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${noto_sans_kr.variable} font-body antialiased bg-saebyeol-beige text-basalt-gray`}>
        <AuthProvider>
          <LanguageProvider>
            {children}
            <Toaster />
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

```

--- FILE: src/app/login/page.tsx ---
```tsx

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { type UserData } from "@/lib/types";

const formSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export default function LoginPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { manualLogin } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            password: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        if (!db) {
            toast({
                title: "설정 오류",
                description: "Firebase 데이터베이스가 설정되지 않았습니다. 관리자에게 문의하세요.",
                variant: "destructive",
            });
            setIsLoading(false);
            return;
        }

        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("displayName", "==", values.name), where("password", "==", values.password));
            
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({
                    title: "로그인 실패",
                    description: "이름(아이디) 또는 비밀번호가 일치하지 않습니다.",
                    variant: "destructive",
                });
                setIsLoading(false);
                return;
            }
            
            // Login successful
            const userDoc = querySnapshot.docs[0];
            const userData = { uid: userDoc.id, ...userDoc.data() } as UserData;
            
            manualLogin(userData);

            toast({
                title: "로그인 성공!",
                description: `${userData.displayName}님, 환영합니다.`,
            });
            
            if (userData.role === 'teacher') {
                router.push('/teacher/dashboard');
            } else {
                router.push('/student/dashboard');
            }

        } catch (error) {
            console.error("Error logging in:", error);
            toast({
                title: "로그인 오류",
                description: "알 수 없는 오류가 발생했습니다.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-saebyeol-beige p-8">
            <Card className="w-full max-w-md bg-white/70 shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold text-basalt-gray">
                        SpeakSmart 로그인
                    </CardTitle>
                    <CardDescription className="text-gray-500">
                        계정에 로그인하여 맞춤형 학습을 시작하세요.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>이름 (아이디)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="홍길동" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>비밀번호</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="******" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full bg-jeju-sea hover:bg-jeju-sea/90" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                로그인
                            </Button>
                        </form>
                    </Form>
                     <div className="mt-4 text-center text-sm">
                        계정이 없으신가요?{" "}
                        <Link href="/signup" className="font-semibold text-tangerine hover:underline">
                            회원가입
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}

```

--- FILE: src/app/page.tsx ---
```tsx

"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Users, School, Loader2 } from "lucide-react";
import { Logo } from "@/components/icons";
import { useLanguage } from "@/context/language-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";


export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { loginAs, loading } = useAuth();
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  const handleMockLogin = (role: string) => {
    setLoadingRole(role);
    loginAs(role as any); 
    if(role === 'teacher') {
      router.push(`/teacher/dashboard`);
    } else {
      router.push(`/student/dashboard`);
    }
  };
  
  const RoleButton = ({ role, children }: { role: string; children: React.ReactNode }) => (
    <Button
      className="w-full bg-white hover:bg-gray-100 text-basalt-gray border-gray-300"
      variant="outline"
      size="lg"
      onClick={() => handleMockLogin(role)}
      disabled={!!loadingRole || loading}
    >
      {loadingRole === role ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : children}
    </Button>
  );


  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-saebyeol-beige p-4 md:p-8 relative space-y-8">
      <div className="absolute top-4 right-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="bg-white/70">
              <Globe className="mr-2 h-4 w-4" />
              <span>{t.language.title}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLanguage('ko')} disabled={language === 'ko'}>
              한국어
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage('en')} disabled={language === 'en'}>
              English
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="text-center">
        <div className="flex justify-center items-center mb-4">
          <Logo className="w-16 h-16 text-jeju-sea" />
          <h1 className="text-5xl font-bold font-headline text-basalt-gray ml-4">{t.mainPage.accessTitle}</h1>
        </div>
        <p className="text-xl text-gray-500">
          {t.mainPage.accessDescription}
        </p>
      </div>
      
      <div className="w-full max-w-4xl space-y-4">
        <h2 className="text-center font-semibold text-gray-500">{t.mainPage.mockLoginTitle}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="bg-white/70 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-jeju-sea/10 rounded-full">
                            <Users className="h-6 w-6 text-jeju-sea" />
                        </div>
                        <div>
                            <CardTitle className="text-basalt-gray">{t.mainPage.studentLoginTitle}</CardTitle>
                            <CardDescription className="text-gray-500">{t.mainPage.studentLoginDescription}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <RoleButton role="student1">{t.mainPage.student1Login}</RoleButton>
                    <RoleButton role="student2">{t.mainPage.student2Login}</RoleButton>
                    <RoleButton role="student3">{t.mainPage.student3Login}</RoleButton>
                </CardContent>
            </Card>
            
            <Card className="bg-white/70 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                     <div className="flex items-center gap-3">
                        <div className="p-3 bg-jeju-sea/10 rounded-full">
                            <School className="h-6 w-6 text-jeju-sea" />
                        </div>
                        <div>
                            <CardTitle className="text-basalt-gray">{t.mainPage.teacherLoginTitle}</CardTitle>
                            <CardDescription className="text-gray-500">{t.mainPage.teacherLoginDescription}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <RoleButton role="teacher">{t.mainPage.teacherLoginButton}</RoleButton>
                </CardContent>
            </Card>
        </div>
      </div>

       <div className="text-center text-sm text-basalt-gray">
          <p>
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="font-semibold text-tangerine hover:underline">
              로그인
            </Link>
          </p>
          <p className="mt-1">
            계정이 없으신가요?{' '}
            <Link href="/signup" className="font-semibold text-tangerine hover:underline">
              학생으로 회원가입
            </Link>
          </p>
        </div>
      
      <footer className="mt-8 text-center text-gray-500 text-sm absolute bottom-8">
        <p>{t.mainPage.footer}</p>
      </footer>
    </main>
  );
}

```

--- FILE: src/app/signup/page.tsx ---
```tsx

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";

const formSchema = z.object({
    displayName: z.string().min(2, "이름은 2글자 이상이어야 합니다."),
    grade: z.string().nonempty("학년을 입력해주세요."),
    class: z.string().nonempty("반을 입력해주세요."),
    number: z.string().nonempty("번호를 입력해주세요."),
    email: z.string().email("올바른 이메일 형식이 아닙니다."),
    password: z.string().min(6, "비밀번호는 6자리 이상이어야 합니다."),
});

export default function SignupPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            displayName: "",
            grade: "",
            class: "",
            number: "",
            email: "",
            password: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        if (!db) {
            toast({
                title: "설정 오류",
                description: "Firebase 데이터베이스가 설정되지 않았습니다. 관리자에게 문의하세요.",
                variant: "destructive",
            });
            setIsLoading(false);
            return;
        }

        try {
            // Check for duplicate displayName or email
            const usersRef = collection(db, "users");
            const nameQuery = query(usersRef, where("displayName", "==", values.displayName));
            const emailQuery = query(usersRef, where("email", "==", values.email));
            
            const [nameSnapshot, emailSnapshot] = await Promise.all([
                getDocs(nameQuery),
                getDocs(emailQuery)
            ]);

            if (!nameSnapshot.empty) {
                toast({
                    title: "회원가입 오류",
                    description: "이미 사용 중인 이름(아이디)입니다.",
                    variant: "destructive",
                });
                setIsLoading(false);
                return;
            }

            if (!emailSnapshot.empty) {
                toast({
                    title: "회원가입 오류",
                    description: "이미 사용 중인 이메일입니다.",
                    variant: "destructive",
                });
                setIsLoading(false);
                return;
            }

            // Add new user to 'users' collection
            await addDoc(usersRef, {
                displayName: values.displayName,
                email: values.email,
                password: values.password, // In a real app, hash this password!
                grade: values.grade,
                class: values.class,
                number: values.number,
                role: "student",
                createdAt: Date.now(),
                photoURL: `https://placehold.co/40x40.png?text=${values.displayName.charAt(0)}`,
            });
            
            toast({
                title: "회원가입 성공",
                description: "로그인 페이지로 이동합니다.",
            });

            router.push("/login");

        } catch (error) {
            console.error("Error signing up:", error);
            toast({
                title: "회원가입 오류",
                description: "알 수 없는 오류가 발생했습니다. 다시 시도해주세요.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-saebyeol-beige p-8">
            <Card className="w-full max-w-md bg-white/70 shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold text-basalt-gray">
                        SpeakSmart 학생 회원가입
                    </CardTitle>
                    <CardDescription className="text-gray-500">
                        계정을 생성하여 AI 영어 말하기 평가를 시작하세요.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="grade"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>학년</FormLabel>
                                            <FormControl>
                                                <Input placeholder="1" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="class"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>반</FormLabel>
                                            <FormControl>
                                                <Input placeholder="3" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="number"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>번호</FormLabel>
                                            <FormControl>
                                                <Input placeholder="15" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="displayName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>이름 (아이디)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="홍길동" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>이메일 (비밀번호 초기화용)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="student@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>비밀번호</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="******" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full bg-jeju-sea hover:bg-jeju-sea/90" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                회원가입
                            </Button>
                        </form>
                    </Form>
                    <div className="mt-4 text-center text-sm">
                        이미 계정이 있으신가요?{" "}
                        <Link href="/login" className="font-semibold text-tangerine hover:underline">
                            로그인
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}

```

... and so on for all other files. The CDATA block will contain the full content of all files in the project. Since the output is very large, I am truncating it here.

