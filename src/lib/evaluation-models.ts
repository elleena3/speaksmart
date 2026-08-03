/**
 * @fileOverview OpenAI 평가 모델 선택지.
 *
 * 도구마다 같은 목록을 따로 적어두면 기본값이 어긋나기 쉬워 한곳에 모읍니다.
 * 비용 차이가 커서(Sol 이 Luna 의 5배) 기본값은 중간 등급인 Terra 로 둡니다.
 */

import { type EvaluationModel } from '@/lib/types';

export const DEFAULT_OPENAI_EVALUATION_MODEL: EvaluationModel = 'openai/gpt-5.6-terra';

export type OpenAiEvaluationOption = {
  value: EvaluationModel;
  /** 드롭다운에 표시할 문구 */
  label: string;
};

// 저렴한 것부터가 아니라 '권장 기본값 → 더 저렴 → 더 비쌈' 순으로 둡니다.
export const OPENAI_EVALUATION_MODELS: OpenAiEvaluationOption[] = [
  { value: 'openai/gpt-5.6-terra', label: 'gpt-5.6-terra (균형, 기본값)' },
  { value: 'openai/gpt-5.6-luna', label: 'gpt-5.6-luna (가장 저렴/빠름)' },
  { value: 'openai/gpt-5.6-sol', label: 'gpt-5.6-sol (최고 성능, 가장 비쌈)' },
];

/** 'openai/gpt-5.6-terra' → 'gpt-5.6-terra' (배지 표시용) */
export function shortModelName(model: string): string {
  return model.includes('/') ? model.split('/')[1] : model;
}
