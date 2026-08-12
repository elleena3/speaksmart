/**
 * @fileOverview 평가 모델 선택지 (OpenAI / Google).
 *
 * 도구마다 같은 목록을 따로 적어두면 기본값이 어긋나기 쉬워 한곳에 모읍니다.
 * 기본값은 비용이 합리적인 등급으로 둡니다.
 */

import { type EvaluationModel } from '@/lib/types';

export const DEFAULT_OPENAI_EVALUATION_MODEL: EvaluationModel = 'openai/gpt-5.6-terra';

export type EvaluationOption = {
  value: EvaluationModel;
  /** 드롭다운에 표시할 문구 */
  label: string;
};

// 저렴한 것부터가 아니라 '권장 기본값 → 더 저렴 → 더 비쌈' 순으로 둡니다.
export const OPENAI_EVALUATION_MODELS: EvaluationOption[] = [
  { value: 'openai/gpt-5.6-terra', label: 'gpt-5.6-terra (균형, 기본값)' },
  { value: 'openai/gpt-5.6-luna', label: 'gpt-5.6-luna (가장 저렴/빠름)' },
  { value: 'openai/gpt-5.6-sol', label: 'gpt-5.6-sol (최고 성능, 가장 비쌈)' },
];

export const DEFAULT_GOOGLE_EVALUATION_MODEL: EvaluationModel = 'googleai/gemini-3.6-flash';

// Gemini 평가 모델. flash 가 훨씬 저렴하고 빨라 기본값으로 둡니다.
export const GOOGLE_EVALUATION_MODELS: EvaluationOption[] = [
  { value: 'googleai/gemini-3.6-flash', label: 'gemini-3.6-flash (빠름, 기본값)' },
  { value: 'googleai/gemini-3.1-pro-preview', label: 'gemini-3.1-pro-preview (고성능)' },
];

/**
 * 동영상을 직접 입력받아 평가할 수 있는 모델.
 *
 * 확인 결과 Gemini 만 video 미디어 파트를 받습니다.
 * Claude 는 동영상을 이미지 파트로 취급해 media_type 오류를 내고,
 * OpenAI 는 파일 파트에 application/pdf 만 허용합니다.
 * 그래서 여기에는 Gemini 만 둡니다.
 */
export const VIDEO_EVALUATION_MODELS: EvaluationOption[] = [
  { value: 'googleai/gemini-3.6-flash', label: 'gemini-3.6-flash (기본/빠름)' },
  { value: 'googleai/gemini-3.1-pro-preview', label: 'gemini-3.1-pro-preview (고성능/정밀)' },
];

/**
 * 음성을 직접 듣고 처리할 수 있는 모델. 받아쓰기·발음 분석 도구가 씁니다.
 *
 * 확인 결과 Gemini 만 오디오 파트를 받습니다.
 * OpenAI 는 파일 파트에 application/pdf 만 허용하고, Claude 는 이미지로 취급해 거부합니다.
 *
 * 값이 evaluationModels 에 없는 것도 있어(flash-lite) 타입을 string 으로 둡니다.
 */
/**
 * 실시간 대화의 발음 평가에 쓰는 모델.
 * 대화를 OpenAI 로 했더라도 소리를 들을 수 있는 것은 Gemini 뿐이라 이 부분만 Gemini 가 맡습니다.
 */
export const PRONUNCIATION_ANALYSIS_MODEL = 'googleai/gemini-3.6-flash';

/**
 * 쉐도잉 연습 평가에 쓰는 모델.
 *
 * 학생 녹음을 들어야 하므로 후보는 Gemini 뿐입니다(OpenAI·Claude 는 오디오를 거부).
 * 두 모델을 같은 녹음으로 비교해 정합니다. 아래 값은 그 결과입니다.
 */
export const SHADOWING_ANALYSIS_MODEL = 'googleai/gemini-3.6-flash';

export type AudioModelOption = { value: string; label: string };

export const DEFAULT_AUDIO_MODEL = 'googleai/gemini-3.6-flash';

export const AUDIO_MODELS: AudioModelOption[] = [
  { value: 'googleai/gemini-3.6-flash', label: 'gemini-3.6-flash (기본/빠름)' },
  { value: 'googleai/gemini-3.1-pro-preview', label: 'gemini-3.1-pro-preview (고성능/정밀)' },
  { value: 'googleai/gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite (가장 가벼움)' },
];

/** 'openai/gpt-5.6-terra' → 'gpt-5.6-terra' (배지 표시용) */
export function shortModelName(model: string): string {
  return model.includes('/') ? model.split('/')[1] : model;
}

/**
 * 평가 문서에 저장된 모델 이름을 지금 부를 수 있는 이름으로 옮깁니다.
 *
 * 평가는 만들 때 고른 모델을 그대로 씁니다. 채점 도중에 모델이 바뀌면
 * 같은 평가인데 학생마다 다른 기준으로 채점되기 때문입니다.
 * 다만 모델이 없어지거나 세대가 바뀌면 저장된 이름으로는 부를 수 없으므로,
 * 그때만 **같은 공급자의 대응 모델**로 옮깁니다. 공급자를 넘어가지 않습니다.
 *
 * 모델이 업그레이드되면 아래 표에 한 줄만 추가하십시오.
 * 예전에는 이 규칙이 플로우 세 곳에 복사되어 있어 서로 어긋날 수 있었습니다.
 */
const MODEL_UPGRADES: Record<string, string> = {
  // Gemini 1.5 / 2.5 세대는 더 이상 제공되지 않습니다. 같은 급의 현행 모델로 옮깁니다.
  'googleai/gemini-1.5-flash': 'googleai/gemini-3.6-flash',
  'googleai/gemini-1.5-flash-latest': 'googleai/gemini-3.6-flash',
  'googleai/gemini-1.5-pro': 'googleai/gemini-3.1-pro-preview',
  'googleai/gemini-2.5-flash': 'googleai/gemini-3.6-flash',
  'googleai/gemini-2.5-flash-lite-preview-06-17': 'googleai/gemini-3.6-flash',
  'googleai/gemini-2.5-pro': 'googleai/gemini-3.1-pro-preview',
};

export function resolveEvaluationModel(stored: string | undefined | null): string {
  // 저장값이 없으면 기본값.
  if (!stored) return DEFAULT_GOOGLE_EVALUATION_MODEL;

  // 예전 값에는 공급자 접두사가 없습니다. 당시에는 Gemini 뿐이었습니다.
  const withPrefix = stored.includes('/') ? stored : `googleai/${stored}`;

  const upgraded = MODEL_UPGRADES[withPrefix];
  if (upgraded) return upgraded;

  // 표에 없는 옛 Gemini 세대도 안전하게 받아 줍니다.
  if (withPrefix.startsWith('googleai/') && /gemini-(1\.5|2\.0|2\.5)/.test(withPrefix)) {
    return withPrefix.includes('pro')
      ? 'googleai/gemini-3.1-pro-preview'
      : DEFAULT_GOOGLE_EVALUATION_MODEL;
  }

  return withPrefix;
}
