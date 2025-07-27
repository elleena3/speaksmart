
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
  input: { schema: GenerateGrowthFeedbackInputSchema },
  output: { schema: GenerateGrowthFeedbackOutputSchema },
  prompt: `You are an expert AI English teacher. Your task is to provide a comprehensive growth analysis for a student by comparing all of their attempts of the same speaking assessment. Your entire response must be in Korean and formatted in Markdown.

Assessment Title: {{{assessmentTitle}}}

Here are all the attempts from the student, in chronological order:
{{#each attempts}}
**Attempt #{{this.attemptNumber}}**
-   Content Score: {{this.contentScore}}/100
-   Pronunciation Score: {{this.pronunciationScore}}/100
-   Transcript: "{{this.transcript}}"
-   AI Feedback Given: "{{this.aiFeedback}}"
-   Curricular Remarks from this attempt: "{{this.curricularRemarks}}"
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
        -   **Heading: "### 💡 총평 및 격려" (Overall Comment & Encouragement):** End with a positive, motivational summary message about their entire journey.

2.  **Generate Teacher Guidance ('teacherGuidance'):**
    -   **Format:** Plain text with clear paragraphs. Do NOT write one long block of text.
    -   **Tone:** Professional and advisory.
    -   **Content:** Summarize the student's overall progress across all attempts. Pinpoint the most significant areas of improvement and persistent weaknesses. Provide clear, actionable advice by suggesting specific activities or teaching strategies. Separate your points into distinct paragraphs for readability.

3.  **Generate '생활기록부 교과 특기 사항' ('growthCurricularRemarks'):**
    -   **Format:** Formal Korean prose, with sentences ending in '~함' or '~임'.
    -   **Tone:** Official and descriptive, suitable for a school record.
    -   **Content:** Your primary source for this summary is the 'Curricular Remarks from this attempt' field provided for each attempt.
        1. Review the curricular remarks from all attempts chronologically.
        2. Synthesize these remarks into a single, cohesive narrative of about 700 Korean characters that shows the student's growth story.
        3. The final remark should start by mentioning the student's persistent effort, describe the initial performance and how it evolved with specific examples from the provided remarks, and conclude by summarizing their current demonstrated ability and attitude.
    -   **IMPORTANT:** If all 'Curricular Remarks from this attempt' fields are empty or contain error messages, you MUST return an empty string for the 'growthCurricularRemarks' field. Do not invent content.

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
    
    // Trim single quotes from the beginning and end of curricularRemarks to fix JSON parsing issues.
    const sanitizedAttempts = input.attempts.map(attempt => {
        let remarks = attempt.curricularRemarks || "";
        if (remarks.startsWith("'") && remarks.endsWith("'")) {
            remarks = remarks.substring(1, remarks.length - 1);
        }
        return {
            ...attempt,
            curricularRemarks: remarks,
        };
    });

    const { output } = await growthFeedbackPrompt({
        ...input,
        attempts: sanitizedAttempts,
    });
    
    if (!output) {
      throw new Error("The AI model did not return valid growth feedback.");
    }
    
    return {
        growthFeedback: output.growthFeedback || "성장 피드백 생성에 실패했습니다.",
        teacherGuidance: output.teacherGuidance || "교사 조언 생성에 실패했습니다.",
        growthCurricularRemarks: output.growthCurricularRemarks || "" // Return empty string if undefined/null
    };
  }
);
