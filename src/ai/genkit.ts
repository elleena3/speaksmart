import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';

config();

// ====================================================================
// 중요: Vertex AI 인증으로 변경되었습니다.
//
// 1. 기존 .env 파일의 GOOGLE_API_KEY는 더 이상 사용되지 않습니다.
// 2. 이 프로젝트의 루트에 있는 .env 파일에 다음 두 가지 환경 변수를 설정해야 합니다.
//    - GOOGLE_CLOUD_PROJECT="speaksmart-evaluator2" (Firebase 프로젝트 ID)
//    - GOOGLE_CLOUD_LOCATION="us-central1" (또는 사용하려는 Vertex AI 리전)
// 3. 서버 환경(Genkit)을 실행하는 서비스 계정에 다음 IAM 역할이 필요합니다.
//    - "Vertex AI 사용자"
//    - "Storage 개체 뷰어" (Firebase Storage 버킷 접근용)
// ====================================================================
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;

if (!GOOGLE_CLOUD_PROJECT || !GOOGLE_CLOUD_LOCATION) {
    console.warn(
      'GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION must be set in the .env file for Vertex AI to work.'
    );
}

export const ai = genkit({
  plugins: [
    googleAI({
      // Vertex AI를 사용하도록 설정합니다.
      // 이 설정은 자동으로 Application Default Credentials (ADC)를 사용하여 인증합니다.
      vertex: {
        project: GOOGLE_CLOUD_PROJECT!,
        location: GOOGLE_CLOUD_LOCATION!,
      },
    }),
  ],
});
