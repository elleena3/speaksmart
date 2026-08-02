import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { config } from 'dotenv';
// 루트('@genkit-ai/compat-oai')의 default 는 GPT 모델을 등록하지 않는
// 범용 openai-compatible 플러그인입니다. 실제 OpenAI 플러그인은 /openai 서브패스에 있습니다.
import openAI from '@genkit-ai/compat-oai/openai';
import anthropic from 'genkitx-anthropic';

config();

const plugins: any[] = [googleAI()];

if (process.env.OPENAI_API_KEY) {
  plugins.push(
    openAI({
      apiKey: process.env.OPENAI_API_KEY,
    } as any)
  );
} else {
  console.warn('OPENAI_API_KEY is not set. OpenAI models will not be available.');
}

if (process.env.ANTHROPIC_API_KEY) {
  plugins.push(
    anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    } as any)
  );
} else {
  console.warn('ANTHROPIC_API_KEY is not set. Anthropic (Claude) models will not be available.');
}

export const ai = genkit({
  plugins,
});
