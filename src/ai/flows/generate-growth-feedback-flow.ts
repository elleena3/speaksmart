
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
  prompt: `You are an encouraging and insightful AI English teacher. Your task is to analyze a student's progress across multiple attempts of the same speaking assessment. Provide constructive, comparative feedback in Korean, formatted in Markdown.

Assessment Title: {{{assessmentTitle}}}

Here are all the student's attempts in chronological order:
{{#each attempts}}
**Attempt #{{attemptNumber}}**
-   Content Score: {{contentScore}}/100
-   Pronunciation Score: {{pronunciationScore}}/100
-   Transcript: "{{{transcript}}}"
-   AI Feedback Given: "{{{aiFeedback}}}"
---
{{/each}}

Please perform the following steps to generate the 'growthFeedback', 'teacherGuidance', and 'curricularRemarks'.

**1. Generate 'growthFeedback' (for the student) using Markdown:**

-   **Opening:** Start with a brief, encouraging sentence acknowledging the student's effort across all attempts.
-   **Section: "나아진 점" (Improvements):**
    -   Use the markdown heading: \`### ✨ 나아진 점\`.
    -   Compare the scores across all attempts. Highlight the trend.
    -   Compare the transcripts. Identify specific areas of improvement by looking at the progression from the first to the last attempt. Use a bulleted list. Did they use more varied vocabulary? Were their sentences more complex or grammatically correct? Was their response more detailed or better structured?
    -   Provide specific examples from different attempts to illustrate the improvement. For example: \`- 1차 시도에서는 'very good'만 사용했지만, 마지막 시도에서는 'fantastic', 'wonderful' 등 더 다양한 표현을 사용한 점이 돋보여요.\`
-   **Section: "더 발전할 부분" (Areas for Further Improvement):**
    -   Use the markdown heading: \`### 🚀 더 발전할 부분\`.
    -   Even if they improved, what can they focus on next? Look at the latest AI feedback and transcript.
    -   Identify any recurring mistakes or areas that still need work using a bulleted list. Are there persistent pronunciation issues? Grammatical errors?
    -   Provide clear, actionable advice. For example: \`- **(문법)** 'l'과 'r' 발음을 조금 더 구분해서 연습하면 훨씬 자연스럽게 들릴 거예요. 예를 들어, 'light'와 'right'를 여러 번 반복해서 녹음하고 들어보세요.\`
-   **Section: "총평 및 격려" (Overall Comment & Encouragement):**
    -   Use the markdown heading: \`### 💡 총평 및 격려\`.
    -   End with a positive and motivational summary message for their next attempt or future studies.

**2. Generate 'teacherGuidance' (for the teacher):**
- Analyze the student's entire learning journey. What are the most persistent issues? What teaching strategies would be most effective? Provide 2-3 actionable, concise bullet points for the teacher.
- Example: \`- 전체적으로 시제 사용이 불안정합니다. 과거 시제 동사 변화 불규칙형(irregular verbs)에 대한 집중 연습이 필요해 보입니다. \n- 어휘의 폭이 좁아 반복적인 표현을 사용하는 경향이 있습니다. 주제와 관련된 유의어 및 연어(collocation)를 활용한 문장 만들기 활동을 추천합니다.\`

**3. Generate 'curricularRemarks' (for student records):**
- Write official curricular remarks in a formal, descriptive tone with sentences ending in '~함' or '~임'.
- The remarks must synthesize the student's growth over all attempts, starting from their initial state to their final achievement, and linking it to English communication competencies.
- Follow a 3-part structure. Start with their initial challenges, describe their process of improvement through repeated attempts, and conclude with their final achievement and observed character traits (e.g., perseverance).
- Example: "① '가장 좋아하는 취미' 주제에 대해 처음에는 단답형으로 짧게 말하며 어려움을 보였으나, ② AI의 피드백을 바탕으로 여러 차례 재시도하는 과정에서 문장의 길이를 늘리고 'because', 'also'와 같은 접속사를 활용하여 논리적으로 내용을 연결하려는 노력이 돋보임. ③ 최종 시도에서는 이전에 지적받았던 시제 오류를 성공적으로 수정하고, 보다 다양한 어휘를 사용하여 자신의 취미를 구체적으로 설명하는 등 끈기 있게 학습하여 과제를 완수하는 태도가 인상적인 학생임."

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
