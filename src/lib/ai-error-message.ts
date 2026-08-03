/**
 * @fileOverview AI 공급자 에러를 화면에 그대로 보여줄 수 있는 한국어 문장으로 바꿉니다.
 *
 * 크레딧 소진, 키 문제, 모델 이름 오류는 원인과 해결 방법이 완전히 다른데
 * 원문 그대로는 "RESOURCE_EXHAUSTED: [429 Too Many Requests] ..." 같은 형태라
 * 교사가 무엇을 해야 할지 알 수 없습니다.
 */

export type AiErrorKind = 'quota' | 'rate_limit' | 'auth' | 'model_not_found' | 'unknown';

export type AiErrorInfo = {
  kind: AiErrorKind;
  /** 화면에 그대로 띄울 수 있는 문장 */
  message: string;
  /** 디버깅용 원문 */
  detail: string;
};

/** 모델 문자열('openai/gpt-4o')에서 공급자 이름을 뽑아 사람이 읽는 형태로 돌려줍니다. */
function providerLabel(model?: string): string {
  if (!model) return 'AI';
  if (model.startsWith('googleai/') || model.includes('gemini')) return 'Google Gemini';
  if (model.startsWith('openai/') || model.includes('gpt')) return 'OpenAI';
  if (model.startsWith('anthropic/') || model.includes('claude')) return 'Anthropic Claude';
  return 'AI';
}

/** 공급자별 결제/사용량 페이지 안내 */
function billingHint(model?: string): string {
  if (!model) return '';
  if (model.startsWith('googleai/') || model.includes('gemini')) {
    return ' Google AI Studio(https://ai.studio/projects)에서 결제 상태를 확인해주세요.';
  }
  if (model.startsWith('openai/') || model.includes('gpt')) {
    return ' OpenAI 대시보드(https://platform.openai.com/settings/organization/billing)에서 잔액을 확인해주세요.';
  }
  if (model.startsWith('anthropic/') || model.includes('claude')) {
    return ' Anthropic 콘솔(https://console.anthropic.com/settings/billing)에서 잔액을 확인해주세요.';
  }
  return '';
}

export function describeAiError(error: unknown, model?: string, task = '분석'): AiErrorInfo {
  const detail = error instanceof Error ? error.message : String(error);
  const lower = detail.toLowerCase();
  const provider = providerLabel(model);

  // 크레딧/할당량 소진. 공급자마다 문구가 달라 넓게 잡습니다.
  const quotaSigns = [
    'credits are depleted',      // Google AI Studio 선불 크레딧 소진
    'insufficient_quota',        // OpenAI 잔액 부족
    'exceeded your current quota',
    'credit balance is too low', // Anthropic 잔액 부족
    'billing',
    'resource_exhausted',
  ];
  if (quotaSigns.some((s) => lower.includes(s))) {
    return {
      kind: 'quota',
      message: `${provider} API 크레딧이 부족하여 ${task}하지 못했습니다.${billingHint(model)}`,
      detail,
    };
  }

  // 순간적인 호출량 초과. 크레딧 문제와 달리 잠시 후 재시도하면 됩니다.
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) {
    return {
      kind: 'rate_limit',
      message: `${provider} 요청이 일시적으로 몰렸습니다. 잠시 후 다시 시도해주세요.`,
      detail,
    };
  }

  if (
    lower.includes('api key') ||
    lower.includes('unauthorized') ||
    lower.includes('permission denied') ||
    lower.includes('401') ||
    lower.includes('403')
  ) {
    return {
      kind: 'auth',
      message: `${provider} API 키에 문제가 있습니다. 서버 환경 변수 설정을 확인해주세요.`,
      detail,
    };
  }

  if (lower.includes('does not exist') || lower.includes('not_found') || lower.includes('not found')) {
    return {
      kind: 'model_not_found',
      message: `선택한 ${provider} 모델(${model ?? '알 수 없음'})을 사용할 수 없습니다. 다른 평가 모델을 선택해주세요.`,
      detail,
    };
  }

  return { kind: 'unknown', message: `${task} 중 오류가 발생했습니다: ${detail}`, detail };
}
