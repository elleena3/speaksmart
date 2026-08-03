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

/** 'openai/gpt-5.6-terra' → 'gpt-5.6-terra' (배지 표시용) */
export function shortModelName(model: string): string {
  return model.includes('/') ? model.split('/')[1] : model;
}
