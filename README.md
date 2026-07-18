# SpeakSmart AI 영어 말하기 평가도구

AI(Gemini)를 활용하여 학생들의 영어 말하기 능력을 실시간으로 평가하고, 개인화된 피드백과 생활기록부 기재용 문구를 생성해주는 교육용 플랫폼입니다.

## 🚀 시작하기

1. **환경 설정**: `.env.example` 파일을 복사하여 `.env` 파일을 만들고 Firebase 및 API 키를 입력하세요.
2. **패키지 설치**: `npm install`
3. **프로그램 실행**: `npm run dev`

## 📘 운영 가이드

상세한 시스템 이관 및 운영 방법은 [OPERATION_GUIDE.md](./OPERATION_GUIDE.md) 파일을 참조하십시오.

## 🛠 주요 기능

- **혼자 말하기(Monologue)**: 주제, 이미지, 네컷 만화를 보고 영어로 발표 및 AI 채점.
- **AI와 대화하기(Dialogue)**: 상황별 시나리오를 바탕으로 AI 원어민 파트너와 실시간 대화.
- **교사용 관리 도구**: 평가 생성, 루브릭 관리, 학생별 성장 분석 및 생기부 문구 자동 생성.
- **기타 도구**: 음성-텍스트 변환(STT), 자필 분석, 동영상 분석 프로토타입 제공.

## 📄 기술 사양

- **Framework**: Next.js (App Router)
- **AI Engine**: Google Gemini (via Genkit)
- **Backend**: Firebase (Firestore, Storage, Auth)
- **UI**: ShadCN UI, Tailwind CSS
