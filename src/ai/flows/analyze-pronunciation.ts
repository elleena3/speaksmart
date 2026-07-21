'use server';

/**
 * @fileOverview Analyzes pronunciation using multiple models for comparison.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export async function analyzePronunciation(audioDataUri: string): Promise<any[]> {
  const modelsToCompare = [
    'googleai/gemini-3.5-flash',
    'googleai/gemini-3.5-flash',
    'googleai/gemini-3.1-pro-preview'
  ];

  const results = await Promise.all(modelsToCompare.map(async (model) => {
    try {
      const response = await ai.generate({
        model,
        prompt: [
          { text: "Evaluate the pronunciation accuracy, intonation, and fluency of this audio. Provide score (0-100) and feedback in Korean." },
          { media: { url: audioDataUri } }
        ],
        output: {
          schema: z.object({
            pronunciationScore: z.number().int(),
            pronunciationFeedback: z.string()
          })
        }
      });
      return { ...response.output, model };
    } catch (e: any) {
      return { model, pronunciationScore: 0, pronunciationFeedback: `Error: ${e.message}` };
    }
  }));

  return results;
}