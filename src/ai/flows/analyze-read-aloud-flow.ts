
'use server';

/**
 * @fileOverview A flow to analyze a user's reading of a given text.
 * It compares the user's audio recording with the original text to provide detailed feedback.
 * 
 * - analyzeReadAloud - A function that takes an audio data URI and the original text, returning detailed analysis.
 * - AnalyzeReadAloudInput - The input type for the flow.
 * - AnalyzeReadAloudOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const AnalyzeReadAloudInputSchema = z.object({
  audioDataUri: z.string().describe(
    "An audio file of the user reading the text, as a data URI."
  ),
  originalText: z.string().describe('The text that the user was supposed to read.'),
});
export type AnalyzeReadAloudInput = z.infer<typeof AnalyzeReadAloudInputSchema>;

const AnalyzeReadAloudOutputSchema = z.object({
  accuracy: z.number().int().min(0).max(100).describe('A score from 0-100 representing how accurately the user read the text (word-for-word match).'),
  fluency: z.number().int().min(0).max(100).describe('A score from 0-100 for the fluency of the reading (flow, pace, and rhythm).'),
  completionRate: z.number().int().min(0).max(100).describe('The percentage of the text that the user actually read.'),
  pronunciationScore: z.number().int().min(0).max(100).describe('A score from 0-100 for the pronunciation of the words.'),
  feedback: z.string().describe('Specific, constructive feedback on the user\'s reading performance, in Korean. It should highlight strengths and areas for improvement.'),
  userTranscript: z.string().describe('The transcript of what the user actually said.'),
});
export type AnalyzeReadAloudOutput = z.infer<typeof AnalyzeReadAloudOutputSchema>;

export async function analyzeReadAloud(input: AnalyzeReadAloudInput): Promise<AnalyzeReadAloudOutput> {
  const result = await analyzeReadAloudFlow(input);
  return result;
}

const readAloudAnalysisPrompt = ai.definePrompt({
    name: 'readAloudAnalysisPrompt',
    model: googleAI.model('gemini-2.5-flash'),
    input: { schema: AnalyzeReadAloudInputSchema },
    output: { schema: AnalyzeReadAloudOutputSchema },
    prompt: `You are an expert English reading and pronunciation coach. Your task is to evaluate a user's spoken English as they read a provided text aloud. Provide all feedback in Korean.

Here is the data for analysis:
- Original Text to be Read: 
"""
{{{originalText}}}
"""

- User's Audio Recording of them reading the text: 
{{media url=audioDataUri}}

Please perform the following steps:
1.  **Transcribe the User's Audio:** First, convert the user's audio into text. This is the 'userTranscript'.
2.  **Calculate Completion Rate:** Compare the user's transcript with the original text. Calculate what percentage of the original text the user actually attempted to read. If the user read only half the text, the completion rate is 50. If the audio is silent, completion rate is 0.
3.  **Calculate Accuracy Score:** Compare the user's transcript to the original text word-for-word. Calculate an accuracy score from 0 to 100 based on how many words were read correctly (matching the text). Deduct points for skipped, inserted, or incorrect words.
4.  **Evaluate Fluency Score:** Listen to the audio for its flow, rhythm, and naturalness. Assign a fluency score from 0 to 100. Consider unnatural pauses, hesitations, and pace.
5.  **Evaluate Pronunciation Score:** Analyze the pronunciation of the words the user spoke. Assign a pronunciation score from 0 to 100 based on clarity, correctness of sounds, and intonation.
6.  **Provide Constructive Feedback:** Write specific, helpful feedback in Korean. This should cover all aspects evaluated: accuracy (mentioning specific words missed or read incorrectly), fluency (commenting on pace and pauses), and pronunciation (pointing out specific sounds or words that need improvement).
7.  **Format the Output:** Return all the calculated scores, the feedback, and the user's transcript in the specified JSON format. If the audio is silent or contains no discernible speech, all scores should be 0, the feedback should state that no speech was detected, and the transcript should be empty.
`,
});

const analyzeReadAloudFlow = ai.defineFlow(
  {
    name: 'analyzeReadAloudFlow',
    inputSchema: AnalyzeReadAloudInputSchema,
    outputSchema: AnalyzeReadAloudOutputSchema,
  },
  async (input) => {
    const { output } = await readAloudAnalysisPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid analysis.");
    }
    return output;
  }
);
