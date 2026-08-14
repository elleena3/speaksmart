'use server';
import { resolveToDataUrl, deleteStoredFile } from '@/lib/server-store';
import { requireTeacher } from '@/lib/auth-guard';

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
  // 서버 액션은 인증 없이 호출될 수 있어 호출자를 먼저 확인합니다.
  await requireTeacher();

  // 큰 파일은 Storage 를 거쳐 URL 로 넘어옵니다(요청 본문 한도).
  const resolvedAudio = await resolveToDataUrl(audioDataUri);

  try {
    const response = await ai.generate({
      model,
      prompt: [
        { text: "Transcribe this audio exactly as heard." },
        { media: { url: resolvedAudio } }
      ]
    });
    return [{ transcript: response.text || '(No text)', model }];
  } catch (e) {
    const info = describeAiError(e, model, '받아쓰기');
    console.error('transcribeFile 실패:', info.kind, info.detail);
    return [{ model, transcript: info.message }];
  }
}