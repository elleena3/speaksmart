/**
 * @fileOverview AI 호출의 일시적 실패를 다루는 공용 규칙.
 *
 * 플로우마다 재시도 조건을 따로 적어 두어 서로 달랐습니다.
 * 어떤 곳은 500 을 재시도하고 어떤 곳은 그대로 실패시켜, 같은 장애에도
 * 화면마다 결과가 달랐습니다. 한곳에 모읍니다.
 *
 * 'use server' 가 아닌 일반 모듈이어야 상수와 헬퍼를 export 할 수 있습니다.
 */

/**
 * 다시 걸어 보면 될 만한 오류인가.
 *
 * 429/503 은 과부하, 500(INTERNAL)은 공급자 쪽 일시 장애입니다.
 * 2026-08 에 gemini-3.6-flash 가 오디오 입력에만 500 을 돌려주는 일이 있었는데,
 * 그때 500 이 재시도 대상이 아니어서 학생 응시가 그대로 실패했습니다.
 */
export function isRetriableAiError(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? String(error ?? '');
  return (
    message.includes('overloaded') ||
    message.includes('503') ||
    message.includes('500') ||
    message.includes('429') ||
    message.includes('UNAVAILABLE') ||
    message.includes('INTERNAL')
  );
}

/**
 * 오디오를 확실히 받는 모델.
 *
 * 실측 결과 학생 녹음을 받는 것은 Gemini 뿐이고(OpenAI·Claude 는 400 으로 거부),
 * Gemini 중에서도 pro 쪽이 flash 보다 안정적이었습니다.
 */
export const AUDIO_FALLBACK_MODEL = 'googleai/gemini-3.1-pro-preview';

/**
 * 오디오를 넘기는 호출에 씁니다.
 * 교사가 고른 모델이 실패하면 위 모델로 한 번 더 시도합니다.
 *
 * 전사가 실패하면 채점 자체가 불가능해 학생이 다시 응시해야 하므로,
 * 모델 하나가 흔들릴 때 그대로 주저앉지 않도록 둡니다.
 */
export async function withAudioFallback<T>(
  model: string,
  run: (model: string) => Promise<T>,
  label: string
): Promise<T> {
  try {
    return await run(model);
  } catch (error) {
    if (model === AUDIO_FALLBACK_MODEL) throw error;
    const detail = ((error as { message?: string })?.message ?? String(error)).split('\n')[0];
    console.warn(`[${label}] ${model} 실패 → ${AUDIO_FALLBACK_MODEL} 로 대체합니다: ${detail}`);
    return run(AUDIO_FALLBACK_MODEL);
  }
}
