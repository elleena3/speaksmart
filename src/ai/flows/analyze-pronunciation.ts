
'use server';

/**
 * @fileOverview A flow to analyze the pronunciation of a spoken English audio file using multiple models for comparison.
 *
 * - analyzePronunciation - A function that takes an audio data URI and returns pronunciation feedback from multiple models.
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

const PronunciationAnalysisResultSchema = PronunciationAnalysisOutputSchema.extend({
  model: z.string().describe('The name of the model that generated this analysis.'),
});

export type PronunciationAnalysisResult = z.infer<typeof PronunciationAnalysisResultSchema>;

export async function analyzePronunciation(audioDataUri: string): Promise<PronunciationAnalysisResult[]> {
  const result = await analyzePronunciationFlow({ audioDataUri });
  return result;
}

const modelsToCompare = [
    'gemini-2.5-flash-lite-preview-06-17',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
];

const createPronunciationPrompt = (modelName: string) => {
    return ai.definePrompt({
        name: `pronunciationAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`, // Allow dots in names
        model: googleAI.model(modelName as any), // Use 'as any' to allow dynamic model names
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
}

const analyzePronunciationFlow = ai.defineFlow(
  {
    name: 'analyzePronunciationFlow',
    inputSchema: PronunciationAnalysisInputSchema,
    outputSchema: z.array(PronunciationAnalysisResultSchema),
  },
  async (input) => {
    
    const analysisPromises = modelsToCompare.map(async (modelName) => {
        try {
            const prompt = createPronunciationPrompt(modelName);
            const { output } = await prompt(input);
            if (!output) {
              throw new Error(`Model ${modelName} returned no output.`);
            }
            return { ...output, model: modelName };
        } catch (error: any) {
            console.error(`Error analyzing with model ${modelName}:`, error);
            // Return a specific error object for this model on failure
            return {
                model: modelName,
                pronunciationScore: 0,
                pronunciationFeedback: `[오류] 모델 분석에 실패했습니다: ${error.message}`
            }
        }
    });

    const results = await Promise.all(analysisPromises);
    
    return results;
  }
);
