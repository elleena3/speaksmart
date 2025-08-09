import { defineFlow } from 'genkit/flow';
import { ai } from './genkit'; // genkit.ts에서 설정한 ai 객체를 가져옵니다.
import { z } from 'zod';

export const mySimpleFlow = defineFlow(
  {
    name: 'mySimpleFlow',
    inputSchema: z.object({ subject: z.string() }),
    outputSchema: z.string(),
  },
  async (input) => {
    const { subject } = input;

    // genkit.ts에서 gpt-4o-preview를 기본 모델로 설정했기 때문에
    // OpenAI 모델이 자동으로 사용됩니다.
    const response = await ai.generate({
      prompt: `${subject}에 대해 한 문장으로 설명해줘.`,
    });

    return response.text();
  }
);