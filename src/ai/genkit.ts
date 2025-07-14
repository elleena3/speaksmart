import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// ====================================================================
// 중요: Google AI Studio에서 생성한 새 API 키를 아래 따옴표 안에 붙여넣으세요.
//
// 1. https://aistudio.google.com/app/apikey 로 이동하세요.
// 2. '새 API 키 만들기'를 클릭하여 키를 생성하고 복사합니다.
// 3. 아래 "여기에..." 부분을 복사한 키로 교체합니다.
// ====================================================================
const GOOGLE_API_KEY = "여기에 Google AI Studio에서 발급받은 API 키를 붙여넣으세요";

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GOOGLE_API_KEY, // GOOGLE_API_KEY가 비어있으면 이 부분에서 오류가 발생합니다.
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});
