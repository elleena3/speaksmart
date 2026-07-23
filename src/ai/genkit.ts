import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { config } from 'dotenv';
import openAI from '@genkit-ai/compat-oai';
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
