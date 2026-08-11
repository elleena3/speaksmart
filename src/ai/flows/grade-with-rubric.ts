'use server';

/**
 * @fileOverview 교사가 만든 루브릭으로 채점합니다.
 *
 * 예전 방식은 모델에게 HTML 리포트를 만들게 한 뒤 정규식으로 점수를 긁어냈는데,
 * 프롬프트가 영어로 지시하는 바람에 한글 항목명을 찾지 못해 모든 점수가 0으로 파싱됐습니다.
 * 게다가 평가 항목이 프롬프트에 고정되어 있어 교사가 만든 루브릭은 쓰이지도 않았습니다.
 *
 * 이제 루브릭 항목을 그대로 모델에 넘기고, 점수는 구조화된 값으로 받습니다.
 * 파싱이 없으니 항목명이 무엇이든, 항목이 몇 개든 그대로 채점됩니다.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  RubricEvaluationSchema,
  RubricCriterionSchema,
  type RubricCriterion,
  type RubricEvaluation,
} from '@/lib/types/ai-schemas';

const GradeWithRubricInputSchema = z.object({
  transcript: z.string().describe("What the student said."),
  activityPrompt: z.string().optional().describe("The task the student was asked to perform."),
  rubricName: z.string().optional(),
  criteria: z.array(RubricCriterionSchema).min(1),
});
export type GradeWithRubricInput = z.infer<typeof GradeWithRubricInputSchema>;

const rubricGradingPrompt = ai.definePrompt({
  name: 'rubricGradingPrompt',
  model: 'googleai/gemini-3.6-flash',
  input: { schema: GradeWithRubricInputSchema },
  output: { schema: RubricEvaluationSchema },
  prompt: `You are an English speaking assessment expert. Grade the student strictly against the rubric below.

{{#if activityPrompt}}
### Task the student was given
{{{activityPrompt}}}
{{/if}}

### What the student said
{{{transcript}}}

### Rubric{{#if rubricName}} — {{{rubricName}}}{{/if}}
{{#each criteria}}
- **{{this.name}}** (max {{this.maxScore}})
  {{#each this.details}}
  - {{this.score}}점: {{this.description}}
  {{/each}}
{{/each}}

### Rules
1. Return one entry per criterion, in the same order, using the criterion name EXACTLY as written above.
2. Never invent, merge or drop a criterion.
3. score must be between 0 and that criterion's maxScore. Copy maxScore from the rubric.
4. Where the rubric gives level descriptions, pick the level that fits and justify with what the student actually said.
5. totalScore is the sum of the awarded scores; totalMaxScore is the sum of the maximums.
6. All feedback and the summary must be written in Korean, and should quote the student's own words where useful.`,
});

export type GradeWithRubricResult = {
  evaluation: RubricEvaluation;
  /** 루브릭 총점을 100점 만점으로 환산한 값. 기존 화면이 쓰는 contentScore 자리에 들어갑니다. */
  percentageScore: number;
};

export async function gradeWithRubric(input: GradeWithRubricInput): Promise<GradeWithRubricResult> {
  const { output } = await rubricGradingPrompt(input);
  if (!output) throw new Error('루브릭 채점 결과를 받지 못했습니다.');

  // 모델이 합계를 틀리게 낼 수 있어 항목 점수로 다시 계산합니다.
  const totalScore = output.criteria.reduce((sum, c) => sum + (c.score || 0), 0);
  const totalMaxScore = output.criteria.reduce((sum, c) => sum + (c.maxScore || 0), 0);
  const percentageScore = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

  return {
    evaluation: { ...output, totalScore, totalMaxScore },
    percentageScore,
  };
}

/** 루브릭 평가 결과를 사람이 읽는 요약 문장으로 만듭니다. 생기부 문구 등에 씁니다. */
export async function describeRubricResult(
  assessmentTitle: string,
  result: GradeWithRubricResult
): Promise<string> {
  const parts = result.evaluation.criteria
    .map((c) => `${c.name} ${c.score}/${c.maxScore}`)
    .join(', ');
  return `'${assessmentTitle}' 루브릭 평가에서 ${parts} 로 총 ${result.evaluation.totalScore}/${result.evaluation.totalMaxScore}점(환산 ${result.percentageScore}점)을 성취함.`;
}
