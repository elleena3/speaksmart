import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';

config();

// ====================================================================
// 중요: .env 파일에 Google AI Studio API 키를 설정해주세요.
//
// 1. [Google AI Studio](https://aistudio.google.com/app/apikey) 로 이동하세요.
// 2. '+ 새 API 키 만들기'를 클릭하여 키를 생성하고 복사합니다.
// 3. 이 프로젝트의 .env 파일을 열고 GOOGLE_API_KEY="여기에_키_붙여넣기" 형식으로 키를 저장하세요.
// ====================================================================
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.warn(
      'GOOGLE_API_KEY is not set in the .env file. AI features will not work. Please get a key from https://aistudio.google.com/app/apikey'
    );
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GOOGLE_API_KEY,
    }),
  ],
});
