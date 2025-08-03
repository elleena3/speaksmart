import {genkit, type Plugin} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';
import openAI, { gpt4o, gpt4Turbo, gpt35Turbo } from '@genkit-ai/compat-oai';

config();

const { GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, OPENAI_API_KEY } = process.env;

const plugins: Plugin[] = [];

if (GOOGLE_CLOUD_PROJECT && GOOGLE_CLOUD_LOCATION) {
  plugins.push(
    googleAI({
      vertex: { project: GOOGLE_CLOUD_PROJECT, location: GOOGLE_CLOUD_LOCATION },
    })
  );
} else {
  console.warn('Google Cloud 변수 미설정 – Google AI 모델 비활성화');
}

if (OPENAI_API_KEY) {
  plugins.push(
    openAI({
      apiKey: OPENAI_API_KEY,
      models: [gpt4o, gpt4Turbo, gpt35Turbo],
    })
  );
} else {
  console.warn('OPENAI_API_KEY 미설정 – OpenAI 모델 비활성화');
}

if (plugins.length === 0) {
  console.error('CRITICAL: 플러그인이 하나도 없습니다.');
}

export const ai = genkit({
  plugins,
});

console.log('🔍 등록된 플러그인', plugins.map(p => p.name));