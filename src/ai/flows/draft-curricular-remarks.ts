// src/ai/flows/draft-curricular-remarks.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for drafting curricular remarks based on a student's performance in a speaking assessment.
 *
 * - draftCurricularRemarks - A function that takes student performance data and generates draft curricular remarks.
 * - DraftCurricularRemarksInput - The input type for the draftCurricularRemarks function.
 * - DraftCurricularRemarksOutput - The return type for the draftCurricularRemarks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DraftCurricularRemarksInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  assessmentName: z.string().describe('The name of the speaking assessment.'),
  speakingPerformanceSummary: z
    .string()
    .describe(
      'A detailed summary of the student’s speaking performance during the assessment.'
    ),
  strengths: z.string().describe('Specific strengths demonstrated by the student.'),
  areasForImprovement: z
    .string()
    .describe('Areas where the student could improve their speaking skills.'),
});
export type DraftCurricularRemarksInput =
  z.infer<typeof DraftCurricularRemarksInputSchema>;

const DraftCurricularRemarksOutputSchema = z.object({
  curricularRemarks: z
    .string()
    .describe(
      'A draft of curricular remarks suitable for inclusion in the student’s academic record.'
    ),
});
export type DraftCurricularRemarksOutput =
  z.infer<typeof DraftCurricularRemarksOutputSchema>;

export async function draftCurricularRemarks(
  input: DraftCurricularRemarksInput
): Promise<DraftCurricularRemarksOutput> {
  return draftCurricularRemarksFlow(input);
}

const draftCurricularRemarksPrompt = ai.definePrompt({
  name: 'draftCurricularRemarksPrompt',
  input: {schema: DraftCurricularRemarksInputSchema},
  output: {schema: DraftCurricularRemarksOutputSchema},
  prompt: `Based on the student's speaking assessment performance, draft curricular remarks. 

Student Name: {{{studentName}}}
Assessment Name: {{{assessmentName}}}
Performance Summary: {{{speakingPerformanceSummary}}}
Strengths: {{{strengths}}}
Areas for Improvement: {{{areasForImprovement}}}

Draft curricular remarks:
`,
});

const draftCurricularRemarksFlow = ai.defineFlow(
  {
    name: 'draftCurricularRemarksFlow',
    inputSchema: DraftCurricularRemarksInputSchema,
    outputSchema: DraftCurricularRemarksOutputSchema,
  },
  async input => {
    const {output} = await draftCurricularRemarksPrompt(input);
    return output!;
  }
);
