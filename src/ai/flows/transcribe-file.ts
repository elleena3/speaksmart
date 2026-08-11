'use server';

/**
 * @fileOverview Transcribes an audio file using multiple models for comparison.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { DEFAULT_AUDIO_MODEL } from '@/lib/evaluation-models';
import { describeAiError } from '@/lib/ai-error-message';

const TranscribeFileInputSchema = z.object({
  audioDataUri: z.string()
});

const TranscriptionResultSchema = z.object({
  transcript: z.string(),
  model: z.string(),
});

/**
 * 선택한 모델 하나로 받아쓰기를 수행합니다.
 * 화면이 목록을 그대로 렌더링하므로 결과는 배열 형태를 유지합니다.
 */
export async function transcribeFile(
  audioDataUri: string,
  model: string = DEFAULT_AUDIO_MODEL
): Promise<any[]> {
  try {
    const response = await ai.generate({
      model,
      prompt: [
        { text: "Transcribe this audio exactly as heard." },
        { media: { url: audioDataUri } }
      ]
    });
    return [{ transcript: response.text || '(No text)', model }];
  } catch (e) {
    const info = describeAiError(e, model, '받아쓰기');
    console.error('transcribeFile 실패:', info.kind, info.detail);
    return [{ model, transcript: info.message }];
  }
}