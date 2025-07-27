
'use server';
/**
 * @fileOverview A flow to generate comparative feedback on a student's growth between two assessment attempts.
 *
 * - generateGrowthFeedback - A function that compares two attempts and provides feedback.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { GenerateGrowthFeedbackInputSchema, GenerateGrowthFeedbackOutputSchema, type GenerateGrowthFeedbackInput, type GenerateGrowthFeedbackOutput } from '@/lib/types/ai-schemas';

export async function generateGrowthFeedback(
  input: GenerateGrowthFeedbackInput
): Promise<GenerateGrowthFeedbackOutput> {
  return generateGrowthFeedbackFlow(input);
}

const growthFeedbackPrompt = ai.definePrompt({
  name: 'growthFeedbackPrompt',
  model: googleAI.model('gemini-2.5-flash'),
  input: { schema: GenerateGrowthFeedbackInputSchema.extend({ hasValidCurricularRemarks: z.boolean() }) },
  output: { schema: GenerateGrowthFeedbackOutputSchema },
  prompt: `You are an expert AI English teacher. Your task is to provide a comprehensive growth analysis for a student by comparing all of their attempts of the same speaking assessment. Your entire response must be in Korean.

Assessment Title: {{{assessmentTitle}}}

Here are all the attempts from the student, in chronological order:
{{#each attempts}}
**Attempt #{{this.attemptNumber}}**
-   Content Score: {{this.contentScore}}/100
-   Pronunciation Score: {{this.pronunciationScore}}/100
-   Transcript: "{{this.transcript}}"
-   AI Feedback Given: "{{this.aiFeedback}}"
-   {{#if this.curricularRemarks}}Curricular Remarks from this attempt: "{{this.curricularRemarks}}"{{/if}}
---
{{/each}}


Please perform the following steps based on ALL attempts provided:

1.  **Generate Student Growth Feedback ('growthFeedback'):**
    -   **Format:** Markdown with clear headings and bullet points for readability.
    -   **Tone:** Encouraging and insightful.
    -   **Content:**
        -   **Opening:** Start with a brief, encouraging sentence acknowledging their effort to try again.
        -   **Heading: "### ✨ 나아진 점" (Improvements):** Analyze the differences between all attempts. Identify upward trends in scores. Compare the transcripts to find specific improvements in vocabulary, sentence structure, fluency, or confidence. Use bullet points and provide concrete examples (e.g., "- **(문법)** 1차 시도에서는 'very good'만 사용했지만, 마지막 시도에서는 'fantastic', 'wonderful' 등 더 다양한 표현을 사용한 점이 돋보여요.").
        -   **Heading: "### 🚀 더 발전할 부분" (Areas for Further Improvement):** Analyze the latest attempt and any recurring issues across all attempts. Provide clear, actionable advice. Use bullet points (e.g., "- **(발음)** 여전히 'l'과 'r' 발음을 조금 더 구분해서 연습하면 훨씬 자연스럽게 들릴 거예요.").
        -   **Heading: "### 💡 총평 및 격려" (Overall Comment & Encouragement):** End with a positive, motivational summary about their entire journey.

2.  **Generate Teacher Guidance ('teacherGuidance'):**
    -   **Format:** Plain text with clear paragraphs. Do NOT write one long block of text.
    -   **Tone:** Professional and advisory.
    -   **Content:** Summarize the student's overall progress across all attempts. Pinpoint the most significant areas of improvement and persistent weaknesses. Provide clear, actionable advice by suggesting specific activities or teaching strategies. Separate your points into distinct paragraphs for readability.

3.  **Generate '생활기록부 교과 특기 사항' ('growthCurricularRemarks'):**
    -   **Format:** Formal Korean prose, with sentences ending in '~함' or '~임'.
    -   **Tone:** Official and descriptive, suitable for a school record.
    -   **Content:** 
        {{#if hasValidCurricularRemarks}}
        Your primary source for this summary is the 'Curricular Remarks from this attempt' field provided for each attempt.
        1. Review the curricular remarks from all valid attempts chronologically.
        2. Synthesize these valid remarks into a single, cohesive narrative of about 700 Korean characters that shows the student's growth story.
        3. The final remark should start by mentioning the student's persistent effort, describe the initial performance and how it evolved with specific examples from the provided remarks, and conclude by summarizing their current demonstrated ability and attitude.
        {{else}}
        You MUST return the exact following message in the 'growthCurricularRemarks' field: "종합 의견을 생성하기 위한 개별 시도의 교과 특기 사항 기록이 부족하거나 유효하지 않습니다."
        {{/if}}

The final output must be a single JSON object containing 'growthFeedback', 'teacherGuidance', and 'growthCurricularRemarks'.
`,
});

const generateGrowthFeedbackFlow = ai.defineFlow(
  {
    name: 'generateGrowthFeedbackFlow',
    inputSchema: GenerateGrowthFeedbackInputSchema,
    outputSchema: GenerateGrowthFeedbackOutputSchema,
  },
  async (input) => {
    
    // 1. Sanitize and validate the input attempts
    const sanitizedAttempts = input.attempts.map(attempt => {
        let remarks = (attempt.curricularRemarks || "").trim();
        const isRemarkInvalid = !remarks || remarks.includes('오류') || remarks.includes('실패') || remarks.includes('없음') || remarks.includes('불가능') || remarks.includes('생성된 내용이 없습니다');
        return {
          ...attempt,
          curricularRemarks: isRemarkInvalid ? null : remarks,
        };
      });

    // 2. Determine if there's any valid data to process
    const hasValidCurricularRemarks = sanitizedAttempts.some(attempt => !!attempt.curricularRemarks);

    // 3. Call the AI prompt with the sanitized data and validation flag
    const { output } = await growthFeedbackPrompt({
        ...input,
        attempts: sanitizedAttempts,
        hasValidCurricularRemarks: hasValidCurricularRemarks,
    });
    
    const defaultErrorMsg = "오류가 발생했거나 생성된 내용이 없습니다.";

    // 4. Final safety check on the output to prevent undefined values.
    const finalOutput: GenerateGrowthFeedbackOutput = {
        growthFeedback: output?.growthFeedback || defaultErrorMsg,
        teacherGuidance: output?.teacherGuidance || defaultErrorMsg,
        curricularRemarks: output?.growthCurricularRemarks || defaultErrorMsg,
    };
    
    return finalOutput;
  }
);
