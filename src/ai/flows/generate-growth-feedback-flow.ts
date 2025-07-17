
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
  prompt: `You are an encouraging and insightful AI English teacher. Your task is to analyze a student's progress between two attempts of the same speaking assessment. Provide constructive, comparative feedback in Korean.

Assessment Title: {{{assessmentTitle}}}

**Previous Attempt (#{{{previousAttempt.attemptNumber}}})**
-   **Content Score:** {{{previousAttempt.contentScore}}}/100
-   **Pronunciation Score:** {{{previousAttempt.pronunciationScore}}}/100
-   **Transcript:** "{{{previousAttempt.transcript}}}"
-   **AI Feedback Given:** "{{{previousAttempt.aiFeedback}}}"

**Latest Attempt (#{{{latestAttempt.attemptNumber}}})**
-   **Content Score:** {{{latestAttempt.contentScore}}}/100
-   **Pronunciation Score:** {{{latestAttempt.pronunciationScore}}}/100
-   **Transcript:** "{{{latestAttempt.transcript}}}"
-   **AI Feedback Given:** "{{{latestAttempt.aiFeedback}}}"

Please perform the following steps to generate the 'growthFeedback':
1.  **Acknowledge Overall Progress:** Start with an encouraging sentence acknowledging the student's effort in re-attempting the assessment.
2.  **Analyze Improvements (나아진 점):**
    -   Compare the scores. If scores have improved, mention it specifically (e.g., "내용 점수가 10점, 발음 점수가 5점 상승하며 크게 발전했어요!").
    -   Compare the transcripts. Identify specific areas of improvement. Did they use more varied vocabulary? Were their sentences more complex or grammatically correct? Was their response more detailed or better structured? Provide specific examples from both transcripts to illustrate the improvement. For example: "이전 답변에서는 'very good'만 사용했지만, 이번에는 'fantastic', 'wonderful' 등 더 다양한 표현을 사용한 점이 돋보여요."
3.  **Identify Areas for Further Improvement (더 발전할 부분):**
    -   Even if they improved, what can they focus on next? Look at the latest AI feedback and transcript.
    -   Identify any recurring mistakes or areas that still need work. Are there persistent pronunciation issues? Grammatical errors?
    -   Provide clear, actionable advice. For example: "다음에는 'l'과 'r' 발음을 조금 더 구분해서 연습하면 훨씬 자연스럽게 들릴 거예요. 예를 들어, 'light'와 'right'를 여러 번 반복해서 녹음하고 들어보세요."
4.  **Provide a Concluding Encouragement:** End with a positive and motivational message for their next attempt or future studies.

The final feedback should be well-structured, easy to read, and directly helpful for the student's learning journey. Use markdown for formatting (e.g., bolding for headers).`,
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
