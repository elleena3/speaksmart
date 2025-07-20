
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
  prompt: `You are an expert AI English teacher and data analyst. Your task is to provide a comprehensive growth analysis for a student across multiple attempts of the same speaking assessment. You will generate three distinct outputs: feedback for the student, guidance for the teacher, and a draft for curricular remarks. All outputs must be in Korean.

Assessment Title: {{{assessmentTitle}}}

**Full History of Attempts (in chronological order):**
{{#each attempts}}
-   **Attempt #{{attemptNumber}}:**
    -   Content Score: {{contentScore}}/100
    -   Pronunciation Score: {{pronunciationScore}}/100
    -   Transcript: "{{{transcript}}}"
    -   AI Feedback Given: "{{{aiFeedback}}}"
{{/each}}

Please perform the following steps:

**1. Generate Student Growth Feedback ('growthFeedback'):**
-   **Format:** Markdown.
-   **Tone:** Encouraging and insightful.
-   **Content:**
    -   **Opening:** Start with a brief, encouraging sentence acknowledging their consistent effort.
    -   **Section: "✨ 나아진 점" (Improvements):** Analyze the entire history. Identify upward trends in scores. Compare early and recent transcripts to find specific improvements in vocabulary, sentence structure, fluency, or confidence. Use bullet points and provide concrete examples (e.g., "- 1차 시도에서는 'very good'만 사용했지만, 마지막 시도에서는 'fantastic', 'wonderful' 등 더 다양한 표현을 사용한 점이 돋보여요.").
    -   **Section: "🚀 더 발전할 부분" (Areas for Further Improvement):** Analyze the latest attempt and any recurring issues throughout all attempts. Provide clear, actionable advice. Use bullet points (e.g., "- **(문법)** 'l'과 'r' 발음을 조금 더 구분해서 연습하면 훨씬 자연스럽게 들릴 거예요.").
    -   **Section: "💡 총평 및 격려" (Overall Comment & Encouragement):** End with a positive, motivational summary message.

**2. Generate Teacher Guidance ('teacherGuidance'):**
-   **Format:** Plain text.
-   **Tone:** Professional and analytical.
-   **Content:** Provide a concise summary of the student's growth trajectory for the teacher. Highlight the most significant improvements and persistent challenges. Offer 2-3 specific, actionable teaching strategies based on this analysis (e.g., "학생은 어휘력에서 큰 성장을 보였으나, 여전히 특정 동사의 과거형 사용에 어려움을 겪고 있습니다. 다음 수업에서 불규칙 동사 과거형을 활용한 짧은 문장 만들기 활동을 추천합니다.").

**3. Generate Curricular Remarks ('curricularRemarks'):**
-   **Format:** Plain text.
-   **Tone:** Formal, descriptive, with sentences ending in '~함' or '~임'.
-   **Content:** Synthesize the student's entire journey on this assessment into a formal remark for their academic record. It should follow a 3-part structure, referencing their growth.
    -   ① Mention their consistent participation and positive attitude towards improvement in the '{{{assessmentTitle}}}' assessment.
    -   ② Provide specific examples of growth, comparing an early attempt to the latest one (e.g., "초기 시도에서는 단답형으로 답변했으나, 마지막 시도에서는 접속사를 활용하여 복잡한 문장을 구사하는 등 논리적 표현력이 크게 향상됨.").
    -   ③ Conclude with an overall evaluation of their current abilities and potential, based on their final attempt.

The final output must be a single JSON object containing 'growthFeedback', 'teacherGuidance', and 'curricularRemarks'.
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
