
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

export const ResultSummarySchema = z.object({
    attemptNumber: z.number().int(),
    contentScore: z.number().int(),
    pronunciationScore: z.number().int(),
    transcript: z.string(),
    aiFeedback: z.string(),
});

export const GenerateGrowthFeedbackInputSchema = z.object({
    previousAttempt: ResultSummarySchema.describe("The student's previous attempt."),
    latestAttempt: ResultSummarySchema.describe("The student's most recent attempt."),
    assessmentTitle: z.string(),
});
export type GenerateGrowthFeedbackInput = z.infer<typeof GenerateGrowthFeedbackInputSchema>;

export const GenerateGrowthFeedbackOutputSchema = z.object({
    growthFeedback: z.string().describe("A comprehensive Markdown-formatted analysis of the student's growth."),
});
export type GenerateGrowthFeedbackOutput = z.infer<typeof GenerateGrowthFeedbackOutputSchema>;


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
  prompt: `You are an expert AI English teacher. Your task is to provide a comprehensive growth analysis for a student by comparing two attempts of the same speaking assessment. Your entire response must be in Korean and formatted in Markdown.

Assessment Title: {{{assessmentTitle}}}

**Previous Attempt (Attempt #{{{previousAttempt.attemptNumber}}})**
-   Content Score: {{previousAttempt.contentScore}}/100
-   Pronunciation Score: {{previousAttempt.pronunciationScore}}/100
-   Transcript: "{{{previousAttempt.transcript}}}"
-   AI Feedback Given: "{{{previousAttempt.aiFeedback}}}"

**Latest Attempt (Attempt #{{{latestAttempt.attemptNumber}}})**
-   Content Score: {{latestAttempt.contentScore}}/100
-   Pronunciation Score: {{latestAttempt.pronunciationScore}}/100
-   Transcript: "{{{latestAttempt.transcript}}}"
-   AI Feedback Given: "{{{latestAttempt.aiFeedback}}}"

Please perform the following steps:

**1. Generate Student Growth Feedback ('growthFeedback'):**
-   **Format:** Markdown.
-   **Tone:** Encouraging and insightful.
-   **Content:**
    -   **Opening:** Start with a brief, encouraging sentence acknowledging their effort to try again.
    -   **Section: "✨ 나아진 점" (Improvements):** Analyze the differences between the two attempts. Identify upward trends in scores. Compare the transcripts to find specific improvements in vocabulary, sentence structure, fluency, or confidence. Use bullet points and provide concrete examples (e.g., "- 이전 시도에서는 'very good'만 사용했지만, 이번에는 'fantastic', 'wonderful' 등 더 다양한 표현을 사용한 점이 돋보여요.").
    -   **Section: "🚀 더 발전할 부분" (Areas for Further Improvement):** Analyze the latest attempt and any recurring issues. Provide clear, actionable advice. Use bullet points (e.g., "- **(문법)** 'l'과 'r' 발음을 조금 더 구분해서 연습하면 훨씬 자연스럽게 들릴 거예요.").
    -   **Section: "💡 총평 및 격려" (Overall Comment & Encouragement):** End with a positive, motivational summary message.

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
