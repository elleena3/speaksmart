'use server';
/**
 * @fileOverview A dedicated flow to regenerate only the comprehensive curricular remarks.
 *
 * - regenerateCurricularRemarks - A function that synthesizes individual remarks into one.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import { ResultSummarySchema } from '@/lib/types/ai-schemas';

const RegenerateRemarksInputSchema = z.object({
  attempts: z.array(ResultSummarySchema).describe("An array of all the student's attempts, from oldest to newest."),
  assessmentTitle: z.string(),
});

const RegenerateRemarksOutputSchema = z.object({
  growthCurricularRemarks: z.string().describe("A comprehensive school record remark based on the student's entire journey."),
});
export type RegenerateRemarksOutput = z.infer<typeof RegenerateRemarksOutputSchema>;


export async function regenerateCurricularRemarks(
  input: z.infer<typeof RegenerateRemarksInputSchema>
): Promise<RegenerateRemarksOutput> {
  return regenerateCurricularRemarksFlow(input);
}


const regenerateRemarksPrompt = ai.definePrompt({
  name: 'regenerateRemarksPrompt',
  model: googleAI.model('gemini-3.5-flash'),
  input: { schema: RegenerateRemarksInputSchema.extend({ hasValidCurricularRemarks: z.boolean() }) },
  output: { schema: RegenerateRemarksOutputSchema },
  prompt: `You are an expert AI English teacher specializing in writing official school records. Your task is to synthesize a student's performance journey into a single, cohesive narrative for their school record ('생활기록부 교과 특기 사항'). Your entire response must be in Korean and formatted in formal prose, with sentences ending in '~함' or '~임'.

Assessment Title: {{{assessmentTitle}}}

Here are all the attempts from the student, in chronological order. Your primary source is the 'curricularRemarks' field from each attempt.
{{#each attempts}}
**Attempt #{{this.attemptNumber}}**
-   Content Score: {{this.contentScore}}/100
-   Pronunciation Score: {{this.pronunciationScore}}/100
-   Curricular Remarks from this attempt: "{{this.curricularRemarks}}"
---
{{/each}}


### Your Task:
{{#if hasValidCurricularRemarks}}
1.  Review the 'Curricular Remarks from this attempt' for all valid attempts provided.
2.  Synthesize these remarks into a single, cohesive narrative of about 700 Korean characters that tells the student's growth story.
3.  The final remark should start by mentioning the student's persistent effort, describe the initial performance and how it evolved with specific examples from the provided remarks, and conclude by summarizing their current demonstrated ability and attitude.
4.  Return this narrative in the 'growthCurricularRemarks' field.
{{else}}
You MUST return the exact following message in the 'growthCurricularRemarks' field: "종합 의견을 생성하기 위한 개별 시도의 교과 특기 사항 기록이 부족하거나 유효하지 않습니다."
{{/if}}
`,
});

const regenerateCurricularRemarksFlow = ai.defineFlow(
  {
    name: 'regenerateCurricularRemarksFlow',
    inputSchema: RegenerateRemarksInputSchema,
    outputSchema: RegenerateRemarksOutputSchema,
  },
  async (input) => {
    // 1. Sanitize and validate the input attempts
    const sanitizedAttempts = input.attempts.map(attempt => {
        let remarks = (attempt.curricularRemarks || "").trim();
        const isRemarkInvalid = !remarks || remarks.includes('오류') || remarks.includes('실패') || remarks.includes('없음') || remarks.includes('불가능');
        return {
          ...attempt,
          curricularRemarks: isRemarkInvalid ? null : remarks,
        };
      });

    // 2. Determine if there's any valid data to process
    const hasValidCurricularRemarks = sanitizedAttempts.some(attempt => !!attempt.curricularRemarks);
    
    // 3. Call the AI prompt with the sanitized data and validation flag
    const { output } = await regenerateRemarksPrompt({
        ...input,
        attempts: sanitizedAttempts,
        hasValidCurricularRemarks: hasValidCurricularRemarks,
    });
    
    // 4. Final safety check on the output
    const finalRemarks = output?.growthCurricularRemarks;
    if (!finalRemarks || finalRemarks.trim() === "") {
        return { growthCurricularRemarks: "오류가 발생했거나 생성된 내용이 없습니다." };
    }
    
    return { growthCurricularRemarks: finalRemarks };
  }
);
