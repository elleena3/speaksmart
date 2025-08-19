
import { genkit, type Plugin } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { config } from 'dotenv';
import openAI from '@genkit-ai/compat-oai';

config();

const plugins: Plugin[] = [googleAI()];

if (process.env.OPENAI_API_KEY) {
  plugins.push(
    openAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  );
} else {
  console.warn('OPENAI_API_KEY is not set. OpenAI models will not be available.');
}

export const ai = genkit({
  plugins,
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
