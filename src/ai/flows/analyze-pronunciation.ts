'use server';

/**
 * @fileOverview Analyzes pronunciation using multiple models for comparison.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export async function analyzePronunciation(audioDataUri: string): Promise<any[]> {
  const modelsToCompare = [
    'gemini-1.5-flash-latest',
    'gemini-2.5-flash-preview-09-2025',
    'gemini-2.5-pro'
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