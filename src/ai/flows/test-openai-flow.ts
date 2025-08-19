import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { gpt4oMini } from '@genkit-ai/compat-oai';

// OpenAI GPT-4o-mini로 간단 프롬프트 테스트
export const testOpenAIFlow = ai.defineFlow('test-openai', {
  input: z.object({
    prompt: z.string()
  }),
  output: z.string(),
}, async ({ prompt }) => {
  const result = await ai.generate({
    model: gpt4oMini,
    prompt: prompt
  });
  return result.text;
});
