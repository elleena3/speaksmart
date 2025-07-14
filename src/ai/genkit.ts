import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// ====================================================================
// 중요: Google AI Studio 또는 Google Cloud 콘솔에서 생성한 
// 새 API 키를 아래 따옴표 안에 붙여넣으세요.
// ====================================================================
const GOOGLE_API_KEY = "새 Google AI API 키를 여기에 붙여넣으세요";

if (!GOOGLE_API_KEY || GOOGLE_API_KEY.includes("여기에")) {
    console.error("FATAL: Google AI API Key is not configured in src/ai/genkit.ts");
    console.error("Please add your new Google AI API key.");
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GOOGLE_API_KEY
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});
