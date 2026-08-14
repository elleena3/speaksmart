'use server';
import { resolveToDataUrl, deleteStoredFile } from '@/lib/server-store';
import { requireTeacher } from '@/lib/auth-guard';

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
  // 서버 액션은 인증 없이 호출될 수 있어 호출자를 먼저 확인합니다.
  await requireTeacher();

  // 큰 파일은 Storage 를 거쳐 URL 로 넘어옵니다(요청 본문 한도).
  const resolvedAudio = await resolveToDataUrl(audioDataUri);

  try {
    const response = await ai.generate({
      model,
      prompt: [
        { text: "Evaluate the pronunciation accuracy, intonation, and fluency of this audio. Provide score (0-100) and feedback in Korean." },
        { media: { url: resolvedAudio } }
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