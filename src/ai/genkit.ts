import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// ====================================================================
// 중요: Google AI Studio 또는 Google Cloud 콘솔에서 생성한 
// 새 API 키를 아래 따옴표 안에 붙여넣으세요.
// ====================================================================
const GOOGLE_API_KEY = "AIzaSyAa2Ic_lOmmiCZFeb5aYE31Vd9mpF4gOBY";

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GOOGLE_API_KEY
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});
