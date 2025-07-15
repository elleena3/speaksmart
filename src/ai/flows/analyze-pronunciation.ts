
'use server';

/**
 * @fileOverview A simple flow to analyze the pronunciation of a spoken English audio file.
 *
 * - analyzePronunciation - A function that takes an audio data URI and returns pronunciation feedback.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const PronunciationAnalysisInputSchema = z.object({
  audioDataUri: z.string().describe(
    "An audio file as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:audio/webm;codecs=opus;base64,<encoded_data>'."
  ),
});

const PronunciationAnalysisOutputSchema = z.object({
  pronunciationScore: z.number().int().min(0).max(100).describe('A score from 0-100 for pronunciation (accuracy, clarity, intonation, and fluency).'),
  pronunciationFeedback: z.string().describe('Specific, constructive feedback on the student\'s pronunciation in Korean.'),
});

export type PronunciationAnalysisOutput = z.infer<typeof PronunciationAnalysisOutputSchema>;

export async function analyzePronunciation(audioDataUri: string): Promise<PronunciationAnalysisOutput> {
  const result = await analyzePronunciationFlow({ audioDataUri });
  return result;
}

const pronunciationAnalysisPrompt = ai.definePrompt({
  name: 'standalonePronunciationAnalysisPrompt',
  model: googleAI.model('gemini-1.5-flash-latest'),
  input: { schema: PronunciationAnalysisInputSchema },
  output: { schema: PronunciationAnalysisOutputSchema },
  prompt: `You are an expert English pronunciation coach. Your task is to evaluate a user's spoken English based on an audio recording. Provide all feedback in Korean.

- User's Audio Recording: {{media url=audioDataUri contentType='audio/webm;codecs=opus'}}

Please perform the following steps:
1.  Listen carefully to the audio.
2.  Evaluate the user's overall accuracy, clarity, intonation, and fluency.
3.  **Assign a Pronunciation Score:** Give a score from 0 to 100 (100 is native-like, 0 is unintelligible).
4.  **Provide Pronunciation Feedback:** Write specific, constructive feedback in Korean. Point out general patterns or specific words/sounds that were pronounced well and those that need improvement. If the audio is silent or contains no discernible speech, provide a score of 0 and state that no speech was detected.
`,
});

const analyzePronunciationFlow = ai.defineFlow(
  {
    name: 'analyzePronunciationFlow',
    inputSchema: PronunciationAnalysisInputSchema,
    outputSchema: PronunciationAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await pronunciationAnalysisPrompt(input);
    if (!output) {
      throw new Error("Failed to get a valid response from the pronunciation analysis model.");
    }
    return output;
  }
);
