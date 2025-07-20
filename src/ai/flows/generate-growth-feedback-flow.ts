
'use server';
/**
 * @fileOverview A flow to generate comparative feedback on a student's growth between two assessment attempts.
 *
 * - generateGrowthFeedback - A function that compares two attempts and provides feedback.
 * - GenerateGrowthFeedbackInput - The input type for the function.
 * - GenerateGrowthFeedbackOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { GenerateGrowthFeedbackInputSchema, GenerateGrowthFeedbackOutputSchema } from '@/lib/types/ai-schemas';

export async function generateGrowthFeedback(
  input: z.infer<typeof GenerateGrowthFeedbackInputSchema>
): Promise<z.infer<typeof GenerateGrowthFeedbackOutputSchema>> {
  return generateGrowthFeedbackFlow(input);
}

const growthFeedbackPrompt = ai.definePrompt({
  name: 'growthFeedbackPrompt',
  model: googleAI.model('gemini-2.5-flash'),
  input: { schema: GenerateGrowthFeedbackInputSchema },
  output: { schema: GenerateGrowthFeedbackOutputSchema },
  prompt: `You are an encouraging and insightful AI English teacher. Your task is to analyze a student's progress between two attempts of the same speaking assessment. Provide constructive, comparative feedback in Korean, formatted in Markdown.

Assessment Title: {{{assessmentTitle}}}

**Previous Attempt (#{{previousAttempt.attemptNumber}}):**
-   Content Score: {{previousAttempt.contentScore}}/100
-   Pronunciation Score: {{previousAttempt.pronunciationScore}}/100
-   Transcript: "{{{previousAttempt.transcript}}}"
-   AI Feedback Given: "{{{previousAttempt.aiFeedback}}}"

**Latest Attempt (#{{latestAttempt.attemptNumber}}):**
-   Content Score: {{latestAttempt.contentScore}}/100
-   Pronunciation Score: {{latestAttempt.pronunciationScore}}/100
-   Transcript: "{{{latestAttempt.transcript}}}"
-   AI Feedback Given: "{{{latestAttempt.aiFeedback}}}"

Please perform the following steps to generate the 'growthFeedback':

-   **Opening:** Start with a brief, encouraging sentence acknowledging their effort.
-   **Section: "나아진 점" (Improvements):**
    -   Use the markdown heading: \`### ✨ 나아진 점\`.
    -   Compare the scores. Highlight which score improved the most.
    -   Compare the transcripts. Identify specific areas of improvement by looking at the progression from the previous to the latest attempt. Use a bulleted list. Did they use more varied vocabulary? Were their sentences more complex or grammatically correct? Was their response more detailed or better structured?
    -   Provide specific examples from both attempts to illustrate the improvement. For example: \`- 1차 시도에서는 'very good'만 사용했지만, 2차 시도에서는 'fantastic', 'wonderful' 등 더 다양한 표현을 사용한 점이 돋보여요.\`
-   **Section: "더 발전할 부분" (Areas for Further Improvement):**
    -   Use the markdown heading: \`### 🚀 더 발전할 부분\`.
    -   Even if they improved, what can they focus on next? Look at the latest AI feedback and transcript.
    -   Identify any recurring mistakes or areas that still need work using a bulleted list. Are there persistent pronunciation issues? Grammatical errors?
    -   Provide clear, actionable advice. For example: \`- **(문법)** 'l'과 'r' 발음을 조금 더 구분해서 연습하면 훨씬 자연스럽게 들릴 거예요. 예를 들어, 'light'와 'right'를 여러 번 반복해서 녹음하고 들어보세요.\`
-   **Section: "총평 및 격려" (Overall Comment & Encouragement):**
    -   Use the markdown heading: \`### 💡 총평 및 격려\`.
    -   End with a positive and motivational summary message for their next attempt or future studies.

The final output must be a single JSON object containing 'growthFeedback'.
`,
});

const generateGrowthFeedbackFlow = ai.defineFlow(
  {
    name: 'generateGrowthFeedbackFlow',
    inputSchema: GenerateGrowthFeedbackInputSchema,
    outputSchema: GenerateGrowthFeedbackOutputSchema,
  },
  async (input) => {
    const { output } = await growthFeedbackPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return valid growth feedback.");
    }
    return output;
  }
);
