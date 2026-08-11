'use server';

/**
 * @fileOverview Analyzes pronunciation using multiple models for comparison.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { DEFAULT_AUDIO_MODEL } from '@/lib/evaluation-models';
import { describeAiError } from '@/lib/ai-error-message';

/**
 * 선택한 모델 하나로 발음을 분석합니다.
 * 화면이 목록을 그대로 렌더링하므로 결과는 배열 형태를 유지합니다.
 */
export async function analyzePronunciation(
  audioDataUri: string,
  model: string = DEFAULT_AUDIO_MODEL
): Promise<any[]> {
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
    return [{ ...response.output, model }];
  } catch (e) {
    const info = describeAiError(e, model, '발음 분석');
    console.error('analyzePronunciation 실패:', info.kind, info.detail);
    return [{ model, pronunciationScore: 0, pronunciationFeedback: info.message }];
  }
}