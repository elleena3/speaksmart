'use server';

/**
 * @fileOverview Provides automated feedback on student's spoken English practice.
 *
 * - generateSpeakingFeedback - A function that generates feedback on a student's spoken English.
 * - GenerateSpeakingFeedbackInput - The input type for the generateSpeakingFeedback function.
 * - GenerateSpeakingFeedbackOutput - The return type for the generateSpeakingFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSpeakingFeedbackInputSchema = z.object({
  activityPrompt: z
    .string()
    .describe('The prompt or instructions for the speaking activity.'),
  expectedFormat: z
    .string()
    .describe('The expected format or key points of the response.'),
  studentRecordingDataUri: z
    .string()
    .describe(
      "The student's voice recording as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  studentFeedbackInstructions: z.string().describe("Instructions for generating feedback for the student."),
});

export type GenerateSpeakingFeedbackInput = z.infer<
  typeof GenerateSpeakingFeedbackInputSchema
>;

const GenerateSpeakingFeedbackOutputSchema = z.object({
  feedback: z.string().describe('The generated feedback for the student.'),
});

export type GenerateSpeakingFeedbackOutput = z.infer<
  typeof GenerateSpeakingFeedbackOutputSchema
>;

export async function generateSpeakingFeedback(
  input: GenerateSpeakingFeedbackInput
): Promise<GenerateSpeakingFeedbackOutput> {
  return generateSpeakingFeedbackFlow(input);
}

const generateSpeakingFeedbackPrompt = ai.definePrompt({
  name: 'generateSpeakingFeedbackPrompt',
  input: {schema: GenerateSpeakingFeedbackInputSchema},
  output: {schema: GenerateSpeakingFeedbackOutputSchema},
  prompt: `You are an AI assistant that provides feedback on student spoken English practice. Your response must be in Korean.

You will use information about the activity prompt, expected format, and the student's recording to provide feedback to the student.

Activity Prompt: {{{activityPrompt}}}
Expected Format: {{{expectedFormat}}}
Student Recording: {{media url=studentRecordingDataUri}}

Instructions for generating feedback for the student: {{{studentFeedbackInstructions}}}

Provide constructive criticism and specific areas for improvement in Korean.
`,
});

const generateSpeakingFeedbackFlow = ai.defineFlow(
  {
    name: 'generateSpeakingFeedbackFlow',
    inputSchema: GenerateSpeakingFeedbackInputSchema,
    outputSchema: GenerateSpeakingFeedbackOutputSchema,
  },
  async input => {
    const {output} = await generateSpeakingFeedbackPrompt(input);
    return output!;
  }
);
