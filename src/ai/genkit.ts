import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// ====================================================================
// 최종 해결 방법: API 키를 여기에 직접 입력해주세요.
// Google Cloud Console에서 "Browser key (auto created by Firebase)" 키를
// 복사하여 아래 따옴표 안에 붙여넣으세요.
// 중요: 이 키의 "애플리케이션 제한사항"이 "없음"으로 설정되어 있는지
// 다시 한번 확인해주세요.
// ====================================================================
const GOOGLE_API_KEY = "YOUR_API_KEY_HERE";

if (!GOOGLE_API_KEY || GOOGLE_API_KEY === "YOUR_API_KEY_HERE") {
    console.error("FATAL: Google AI API Key is not configured in src/ai/genkit.ts");
    console.error("Please replace 'YOUR_API_KEY_HERE' with your actual API key.");
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GOOGLE_API_KEY
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});
