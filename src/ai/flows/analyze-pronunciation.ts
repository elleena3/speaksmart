'use server';

/**
 * @fileOverview Analyzes pronunciation using multiple models for comparison.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { AUDIO_COMPARISON_MODELS } from '@/lib/evaluation-models';

export async function analyzePronunciation(audioDataUri: string): Promise<any[]> {
  // 예전에는 gemini-3.6-flash 가 두 번 들어가 있어 같은 모델 결과가 두 줄 나왔습니다.
  const modelsToCompare = AUDIO_COMPARISON_MODELS;

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