'use server';

/**
 * @fileOverview Transcribes an audio file using multiple models for comparison.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const TranscribeFileInputSchema = z.object({
  audioDataUri: z.string()
});

const TranscriptionResultSchema = z.object({
  transcript: z.string(),
  model: z.string(),
});

export async function transcribeFile(audioDataUri: string): Promise<any[]> {
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