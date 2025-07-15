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
