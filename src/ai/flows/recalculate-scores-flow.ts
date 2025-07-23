
'use server';

/**
 * @fileOverview A flow to recalculate rubric scores for an existing assessment result.
 * It takes the original student transcript and generates a new rubric analysis.
 * 
 * - recalculateScores - A function that takes a result and returns a new rubric analysis.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { evaluationModels, type RubricScores, type StudentResult } from '@/lib/types';

// Define the schema for the input, which includes the student's original transcript and the assessment type.
const RecalculateScoresInputSchema = z.object({
  studentTranscript: z.string().describe("The student's original transcript (for monologue) or full conversation history (for dialogue)."),
  assessmentType: z.enum(["monologue", "dialogue"]).describe("The type of the original assessment."),
  evaluationModel: z.enum(evaluationModels).optional().describe("The AI model to use for re-evaluation."),
  assessmentTitle: z.string().optional().describe('The title of the assessment.'),
});
export type RecalculateScoresInput = z.infer<typeof RecalculateScoresInputSchema>;

// The output will be the new rubric-based feedback and scores.
const RecalculateScoresOutputSchema = z.object({
    aiFeedback: z.string().describe("The new rubric-based feedback in Markdown format."),
    rubricScores: z.object({
        fluency: z.number(),
        pronunciation: z.number(),
        grammar: z.number(),
        vocabulary: z.number(),
        interaction: z.number().optional(),
    }),
    contentScore: z.number(),
    pronunciationScore: z.number(),
    teacherGuidance: z.string(),
    curricularRemarks: z.string(),
});
export type RecalculateScoresOutput = z.infer<typeof RecalculateScoresOutputSchema>;


export async function recalculateScores(input: RecalculateScoresInput): Promise<RecalculateScoresOutput> {
  return recalculateScoresFlow(input);
}


// Helper to parse scores from the rubric's text output.
const parseScore = (text: string, category: string): number => {
    const regex = new RegExp(`${category}[\\s\\S]*?점수[^\\d]*(\\d)`);
    const match = text.match(regex);
    return match ? parseInt(match[1], 10) : 0;
};


// Define the rubric-generation prompt. This can be shared by both monologue and dialogue recalculations.
const rubricPrompt = ai.definePrompt({
  name: 'recalculateRubricPrompt',
  input: { schema: RecalculateScoresInputSchema },
  // The prompt directly outputs text, which we will parse.
  prompt: `### 역할 (Role)
당신은 사용자의 영어 회화 실력을 정확하게 분석하고 피드백을 제공하는 전문 AI 평가관입니다. 당신의 목표는 객관적인 평가 기준에 따라 사용자의 강점과 약점을 진단하고, 실력 향상에 도움이 되는 건설적인 피드백을 제공하는 것입니다.

### 지시사항 (Instructions)
아래에 제공될 **[사용자 발화 내용]**을 분석합니다.

이어지는 **[평가 기준 루브릭]**을 절대적인 기준으로 삼아, 평가 항목 각각에 대해 1점에서 5점까지의 점수를 부여합니다.
- '혼자 말하기' 과제인 경우, '내용 이해 및 상호작용' 항목은 1점으로 고정합니다.
- 'AI와 대화하기' 과제인 경우, 모든 5개 항목을 평가합니다.

각 항목별로 왜 해당 점수를 부여했는지에 대한 구체적인 근거를 사용자의 발화 내용에서 찾아 제시합니다.

실력 향상을 위한 실질적이고 실행 가능한 조언을 포함한 피드백을 작성합니다.

모든 최종 결과는 반드시 맨 마지막의 **[출력 형식(마크다운)]**에 맞춰 생성해야 합니다.

### [사용자 발화 내용]
{{{studentTranscript}}}

### 평가 기준 루브릭 (Evaluation Rubric)
[평가 항목: 유창성 (Fluency)]
5점 (최상): 원어민과 가까운 속도와 리듬으로 매우 자연스럽게 말함.
4점 (상): 큰 막힘 없이 안정적인 속도로 말함.
3점 (중): 비교적 이해 가능한 속도로 말하지만, 머뭇거림이 눈에 띔.
2점 (하): 매우 느리고 자주 끊어지며 말함.
1점 (최하): 단어 단위로 말함.

[평가 항목: 발음 및 억양 (Pronunciation & Intonation)]
5점 (최상): 발음이 매우 명확하고 자연스러운 억양을 사용함.
4점 (상): 대부분의 발음이 정확하여 쉽게 이해할 수 있음.
3점 (중): 일부 단어의 발음이 부정확하여 가끔 재확인이 필요함.
2점 (하): 부정확한 발음이 많아 이해하기 위해 노력이 필요함.
1점 (최하): 발음을 거의 이해할 수 없음.

[평가 항목: 문법 (Grammar)]
5점 (최상): 복잡한 문장 구조를 포함하여 다양한 문법을 거의 실수 없이 사용함.
4점 (상): 일상적인 문법 구조를 대부분 정확하게 사용함.
3점 (중): 기본적인 문장 구조는 사용하나, 반복적인 실수가 나타남.
2점 (하): 기본적인 문장 구성에도 오류가 많음.
1점 (최하): 문장을 거의 구성하지 못함.

[평가 항목: 어휘 (Vocabulary)]
5점 (최상): 주제에 맞게 폭넓고 수준 높은 어휘를 정확하게 사용함.
4점 (상): 주제에 대해 논의하기에 충분한 어휘를 구사함.
3점 (중): 기본적인 어휘는 구사하나, 어휘의 폭이 좁아 반복적인 단어를 사용함.
2점 (하): 매우 제한적인 어휘만 알고 있음.
1점 (최하): 극소수의 기본 단어만 알고 있음.

[평가 항목: 내용 이해 및 상호작용 (Comprehension & Interaction)]
5점 (최상): 상대방의 말을 완벽하게 이해하고 대화의 흐름을 주도함.
4. 상): 대부분의 말을 어려움 없이 이해하고 적절히 반응함.
3점 (중): 간단한 문장은 이해하나, 길거나 빠른 문장은 이해에 어려움을 겪음.
2점 (하): 아주 간단한 질문만 이해하고, 대화에 거의 참여하지 못함.
1점 (최하): 상대방의 말을 거의 이해하지 못함. (혼자 말하기의 경우 이 점수)

### 출력 형식 (Output Format)
[중요] 아래의 마크다운 구조와 스타일을 반드시 준수하여 리포트 형식으로 결과를 생성해 주세요.

# 📝 영어 회화 능력 종합 분석 리포트

## 💬 총평 (Overall Comment)
[사용자의 전반적인 회화 능력에 대한 총평과 격려의 메시지를 1~2문장으로 작성해 주세요.]

## 📊 종합 점수 (Overall Score)
**[평가한 항목들의 점수 평균을 100점 만점으로 환산한 최종 점수를 "최종 점수는 100점 만점에 00점입니다." 형식으로 여기에 표시해 주세요.]**

## 📊 항목별 상세 분석 (Detailed Analysis)

### 🗣️ 유창성 (Fluency) - 📈 점수: [점수]/5점
| 👍 잘한 점 (Strengths) | 💡 개선점 (Areas for Improvement) |
| --- | --- |
| [유창성 측면에서 잘한 점을 구체적인 예시를 들어 칭찬해 주세요. 목록 형식(-)으로 작성하세요.] | [유창성을 저해하는 요소를 지적하고, 개선을 위한 실질적인 조언 1~2가지를 목록 형식(-)으로 제안해 주세요.] |

### 🎤 발음 및 억양 (Pronunciation & Intonation) - 📈 점수: [점수]/5점
| 👍 잘한 점 (Strengths) | 💡 개선점 (Areas for Improvement) |
| --- | --- |
| [발음이 명확했거나 특정 단어/억양이 좋았던 점을 목록 형식(-)으로 칭찬해 주세요.] | [부정확했던 발음의 예시('단어'의 발음이 '발음'으로 들렸습니다)를 제시하고, 개선 방법을 목록 형식(-)으로 제안해 주세요.] |

### ✍️ 문법 (Grammar) - 📈 점수: [점수]/5점
| 👍 잘한 점 (Strengths) | 💡 개선점 (Areas for Improvement) |
| --- | --- |
| [정확하게 사용한 문법 구조를 목록 형식(-)으로 칭찬해 주세요.] | [반복적으로 틀린 문법을 지적하고, 올바른 문장 예시와 함께 수정안을 목록 형식(-)으로 제시해 주세요.] |

### 📚 어휘 (Vocabulary) - 📈 점수: [점수]/5점
| 👍 잘한 점 (Strengths) | 💡 개선점 (Areas for Improvement) |
| --- | --- |
| [주제에 맞게 적절히 사용한 좋은 단어나 표현을 목록 형식(-)으로 칭찬해 주세요.] | [어휘의 폭을 넓히기 위해, 사용자가 쓴 단어를 대체할 수 있는 더 나은 표현을 목록 형식(-)으로 추천해 주세요.] |

### 🤝 내용 이해 및 상호작용 (Comprehension & Interaction) - 📈 점수: [점수]/5점
| 👍 잘한 점 (Strengths) | 💡 개선점 (Areas for Improvement) |
| --- | --- |
| [{{#if (eq assessmentType "dialogue")}}AI의 질문을 잘 이해하고 적절하게 답변한 부분을 목록 형식(-)으로 칭찬해 주세요.{{else}}- 혼자 말하기 과제에서는 평가하지 않는 항목입니다.{{/if}}] | [{{#if (eq assessmentType "dialogue")}}상호작용에서 아쉬웠던 점이나 개선할 점을 목록 형식(-)으로 지적해 주세요.{{else}}- 혼자 말하기 과제에서는 평가하지 않는 항목입니다.{{/if}}] |
`,
});

const recalculateScoresFlow = ai.defineFlow(
  {
    name: 'recalculateScoresFlow',
    inputSchema: RecalculateScoresInputSchema,
    outputSchema: RecalculateScoresOutputSchema,
  },
  async (input) => {
    const model = input.evaluationModel || 'gemini-2.5-flash';
    const llmResponse = await rubricPrompt(input, {model: googleAI.model(model)});
    const rubricText = llmResponse.text;
    
    const rubricScores: RubricScores = {
        fluency: parseScore(rubricText, '유창성'),
        pronunciation: parseScore(rubricText, '발음 및 억양'),
        grammar: parseScore(rubricText, '문법'),
        vocabulary: parseScore(rubricText, '어휘'),
    };
    
    let contentScore: number;
    
    if (input.assessmentType === 'dialogue') {
      rubricScores.interaction = parseScore(rubricText, '내용 이해 및 상호작용');
      contentScore = Math.round(((rubricScores.fluency + rubricScores.grammar + rubricScores.vocabulary + (rubricScores.interaction || 0)) / 4) * 20);
    } else {
      contentScore = Math.round(((rubricScores.fluency + rubricScores.grammar + rubricScores.vocabulary) / 3) * 20);
    }
    
    const pronunciationScore = rubricScores.pronunciation * 20;

    // Generate teacher guidance and curricular remarks based on the new scores.
    const remarksContent = `'${input.assessmentTitle || '평가'}'에서 재계산된 루브릭 기반으로 종합 ${contentScore}점, 발음 ${pronunciationScore}점을 받는 등 준수한 성취를 보임.`;
    
    return {
        aiFeedback: rubricText,
        rubricScores,
        contentScore,
        pronunciationScore,
        teacherGuidance: "루브릭 기반 평가를 재실행했습니다. 학생의 변동된 점수를 확인하고, 항목별 강점과 약점을 다시 한번 지도해주세요.",
        curricularRemarks: remarksContent,
    };
  }
);
