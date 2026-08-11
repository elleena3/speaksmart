/**
 * @fileOverview 루브릭 채점 결과를 사람이 읽는 형태로 바꾸는 헬퍼.
 *
 * 화면과 서버 양쪽에서 쓰이므로 'use server' 가 아닌 일반 모듈에 둡니다.
 */

import { type RubricEvaluation } from '@/lib/types/ai-schemas';

/** 항목별 점수를 표 형태의 마크다운으로 만듭니다. 기존 화면이 aiFeedback 을 그대로 렌더링합니다. */
export function renderRubricSummary(result: { evaluation: RubricEvaluation; percentageScore: number }): string {
  const { evaluation, percentageScore } = result;

  const rows = evaluation.criteria
    .map((c) => `| ${c.name} | ${c.score} / ${c.maxScore} | ${c.feedback.replace(/\|/g, '\\|')} |`)
    .join('\n');

  return [
    `### 루브릭 채점 결과`,
    ``,
    `**총점 ${evaluation.totalScore} / ${evaluation.totalMaxScore}점** (100점 환산 ${percentageScore}점)`,
    ``,
    `| 평가 항목 | 점수 | 피드백 |`,
    `| --- | --- | --- |`,
    rows,
    ``,
    `### 총평`,
    ``,
    evaluation.summary,
  ].join('\n');
}

/**
 * 루브릭 안에서 발음 항목을 찾아 100점 환산 점수를 돌려줍니다.
 * 발음 항목이 없는 루브릭(예: 글쓰기 평가)도 있으므로 없으면 null 입니다.
 */
export function pickPronunciationScore(result: { evaluation: RubricEvaluation }): number | null {
  const hit = result.evaluation.criteria.find((c) =>
    /발음|억양|pronunciation|intonation/i.test(c.name)
  );
  if (!hit || !hit.maxScore) return null;
  return Math.round((hit.score / hit.maxScore) * 100);
}
