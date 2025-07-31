import {genkit, type Plugin} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';
import { openAI } from 'genkitx-openai'; // Corrected: named import

config();

// ====================================================================
// 중요: Vertex AI 인증으로 변경되었습니다.
//
// 1. 기존 .env 파일의 GOOGLE_API_KEY는 더 이상 사용되지 않습니다.
// 2. 이 프로젝트의 루트에 있는 .env 파일에 다음 두 가지 환경 변수를 설정해야 합니다.
//    - GOOGLE_CLOUD_PROJECT="your-project-id" (Firebase 프로젝트 ID)
//    - GOOGLE_CLOUD_LOCATION="us-central1" (또는 사용하려는 Vertex AI 리전)
// 3. 서버 환경(Genkit)을 실행하는 서비스 계정에 다음 IAM 역할이 필요합니다.
//    - "Vertex AI 사용자"
//    - "Storage 개체 뷰어" (Firebase Storage 버킷 접근용)
// ====================================================================

const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const plugins: Plugin[] = [];

if (GOOGLE_CLOUD_PROJECT && GOOGLE_CLOUD_LOCATION) {
    plugins.push(googleAI({
      vertex: {
        project: GOOGLE_CLOUD_PROJECT,
        location: GOOGLE_CLOUD_LOCATION,
      },
    }));
} else {
    console.warn(
      'Google Cloud (Vertex AI) environment variables not set. Google AI models will not be available.'
    );
}

if (OPENAI_API_KEY) {
    plugins.push(openAI({ // Corrected: Call openAI as a function
        apiKey: process.env.OPENAI_API_KEY,
    }));
} else {
    console.warn('OPENAI_API_KEY not set. OpenAI models will not be available.');
}

if (plugins.length === 0) {
    console.error("CRITICAL: No AI model providers have been configured. The application will not work as expected.");
}


export const ai = genkit({
  plugins: plugins,
});
