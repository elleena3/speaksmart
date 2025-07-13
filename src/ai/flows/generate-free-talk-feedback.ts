'use server';

/**
 * @fileOverview Analyzes a free-form English conversation and provides feedback.
 *
 * - generateFreeTalkFeedback - A function that generates rubric-based feedback for a student and guidance for a teacher.
 */

import { ai } from '@/ai/genkit';
import {
  GenerateFreeTalkFeedbackInput,
  GenerateFreeTalkFeedbackInputSchema,
  GenerateFreeTalkFeedbackOutput,
  GenerateFreeTalkFeedbackOutputSchema,
} from '@/lib/types/ai-schemas';

export async function generateFreeTalkFeedback(
  input: GenerateFreeTalkFeedbackInput
): Promise<GenerateFreeTalkFeedbackOutput> {
  return generateFreeTalkFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFreeTalkFeedbackPrompt',
  input: { schema: GenerateFreeTalkFeedbackInputSchema },
  output: { schema: GenerateFreeTalkFeedbackOutputSchema },
  prompt: `You are an expert English teacher evaluating a student's free conversation with an AI.
Analyze the conversation transcript provided. Your entire response must be in the specified JSON format.
All text feedback and guidance must be in Korean.

Conversation Transcript:
{{{conversationTranscript}}}

Based on the transcript, evaluate the student's performance on a 5-point scale for each category of the rubric (Fluency, Pronunciation, Vocabulary, Grammar).
1: Needs significant improvement
2: Below expectations
3: Meets expectations
4: Above expectations
5: Excellent

Provide specific, constructive feedback for the student for each rubric category and an overall summary.
Also, provide actionable guidance for the teacher on how to help the student improve.
`,
});

const generateFreeTalkFeedbackFlow = ai.defineFlow(
  {
    name: 'generateFreeTalkFeedbackFlow',
    inputSchema: GenerateFreeTalkFeedbackInputSchema,
    outputSchema: GenerateFreeTalkFeedbackOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
