'use server';

/**
 * @fileOverview Transcribes an audio file using multiple models for comparison.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { AUDIO_COMPARISON_MODELS } from '@/lib/evaluation-models';

const TranscribeFileInputSchema = z.object({
  audioDataUri: z.string()
});

const TranscriptionResultSchema = z.object({
  transcript: z.string(),
  model: z.string(),
});

export async function transcribeFile(audioDataUri: string): Promise<any[]> {
  // 예전에는 gemini-3.6-flash 가 두 번 들어가 있어 같은 모델 결과가 두 줄 나왔습니다.
  const modelsToCompare = AUDIO_COMPARISON_MODELS;

  const results = await Promise.all(modelsToCompare.map(async (model) => {
    try {
      const response = await ai.generate({
        model,
        prompt: [
          { text: "Transcribe this audio exactly as heard." },
          { media: { url: audioDataUri } }
        ]
      });
      return { transcript: response.text || '(No text)', model };
    } catch (e: any) {
      return { model, transcript: `Error: ${e.message}` };
    }
  }));

  return results;
}