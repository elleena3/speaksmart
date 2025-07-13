'use server';

/**
 * @fileOverview Analyzes a free-form English conversation and provides feedback.
 *
 * - generateFreeTalkFeedback - A function that generates rubric-based feedback for a student and guidance for a teacher.
 * - GenerateFreeTalkFeedbackInput - The input type for the function.
 * - GenerateFreeTalkFeedbackOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const GenerateFreeTalkFeedbackInputSchema = z.object({
  conversationTranscript: z
    .string()
    .describe('The full transcript of the conversation between the AI and the student.'),
});
export type GenerateFreeTalkFeedbackInput = z.infer<typeof GenerateFreeTalkFeedbackInputSchema>;

const RubricItemSchema = z.object({
  score: z.number().describe('The score for this category, from 1 to 5.'),
  feedback: z.string().describe('Specific feedback for this category.'),
});

export const GenerateFreeTalkFeedbackOutputSchema = z.object({
  studentFeedback: z.object({
    overall: z.string().describe('Overall feedback for the student in Korean.'),
    rubric: z.object({
      fluency: RubricItemSchema.describe('Assessment of the flow and smoothness of speech.'),
      pronunciation: RubricItemSchema.describe('Assessment of the clarity of speech and sounds.'),
      vocabulary: RubricItemSchema.describe('Assessment of the range and appropriateness of word choice.'),
      grammar: RubricItemSchema.describe('Assessment of the accuracy of sentence structure.'),
    }),
  }),
  teacherGuidance: z
    .string()
    .describe(
      'Actionable guidance for the teacher on how to help this student improve, in Korean.'
    ),
});
export type GenerateFreeTalkFeedbackOutput = z.infer<typeof GenerateFreeTalkFeedbackOutputSchema>;

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
