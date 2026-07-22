'use server';

/**
 * @fileOverview Summarizes student feedback on assessment activities for teachers.
 *
 * - summarizeStudentFeedback - A function to summarize student feedback.
 * - SummarizeStudentFeedbackInput - The input type for the summarizeStudentFeedback function.
 * - SummarizeStudentFeedbackOutput - The return type for the summarizeStudentFeedback function.
 */

import {ai} from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import {z} from 'genkit';

const SummarizeStudentFeedbackInputSchema = z.object({
  feedbackText: z
    .string()
    .describe('The text of the student feedback to be summarized.'),
});
export type SummarizeStudentFeedbackInput = z.infer<
  typeof SummarizeStudentFeedbackInputSchema
>;

const SummarizeStudentFeedbackOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'A concise summary of the student feedback, highlighting key areas for improvement in evaluation content or teaching methods.'
    ),
});
export type SummarizeStudentFeedbackOutput = z.infer<
  typeof SummarizeStudentFeedbackOutputSchema
>;

export async function summarizeStudentFeedback(
  input: SummarizeStudentFeedbackInput
): Promise<SummarizeStudentFeedbackOutput> {
  return summarizeStudentFeedbackFlow(input);
}

const summarizeStudentFeedbackPrompt = ai.definePrompt({
  name: 'summarizeStudentFeedbackPrompt',
  model: googleAI.model('gemini-3.6-flash'),
  input: {schema: SummarizeStudentFeedbackInputSchema},
  output: {schema: SummarizeStudentFeedbackOutputSchema},
  prompt: `You are an AI assistant helping teachers improve their assessment activities.

  Please summarize the following student feedback, focusing on identifying areas where the evaluation content or teaching methods can be improved:

  Feedback: {{{feedbackText}}}
  `,
});

const summarizeStudentFeedbackFlow = ai.defineFlow(
  {
    name: 'summarizeStudentFeedbackFlow',
    inputSchema: SummarizeStudentFeedbackInputSchema,
    outputSchema: SummarizeStudentFeedbackOutputSchema,
  },
  async input => {
    const {output} = await summarizeStudentFeedbackPrompt(input);
    return output!;
  }
);
