// src/ai/flows/draft-curricular-remarks.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for drafting curricular remarks based on a student's performance in a speaking assessment.
 *
 * - draftCurricularRemarks - A function that takes student performance data and generates draft curricular remarks.
 * - DraftCurricularRemarksInput - The input type for the draftCurricularRemarks function.
 * - DraftCurricularRemarksOutput - The return type for the draftCurricularRemarks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DraftCurricularRemarksInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  assessmentName: z.string().describe('The name of the speaking assessment.'),
  speakingPerformanceSummary: z
    .string()
    .describe(
      'A detailed summary of the student’s speaking performance during the assessment.'
    ),
  strengths: z.string().describe('Specific strengths demonstrated by the student.'),
  areasForImprovement: z
    .string()
    .describe('Areas where the student could improve their speaking skills.'),
});
export type DraftCurricularRemarksInput =
  z.infer<typeof DraftCurricularRemarksInputSchema>;

const DraftCurricularRemarksOutputSchema = z.object({
  curricularRemarks: z
    .string()
    .describe(
      'A draft of curricular remarks suitable for inclusion in the student’s academic record.'
    ),
});
export type DraftCurricularRemarksOutput =
  z.infer<typeof DraftCurricularRemarksOutputSchema>;

export async function draftCurricularRemarks(
  input: DraftCurricularRemarksInput
): Promise<DraftCurricularRemarksOutput> {
  return draftCurricularRemarksFlow(input);
}

const draftCurricularRemarksPrompt = ai.definePrompt({
  name: 'draftCurricularRemarksPrompt',
  input: {schema: DraftCurricularRemarksInputSchema},
  output: {schema: DraftCurricularRemarksOutputSchema},
  prompt: `You are an AI assistant tasked with writing official curricular remarks for a student's record based on their English speaking performance. The remarks must be in Korean, written in a formal, descriptive tone with sentences ending in '~함' or '~임'. The output should be concise and structured into three parts, similar to the provided example format.

Context for generating remarks:
'영어 회화 교과 성취 기준은 크게 듣기, 말하기 영역으로 나뉩니다. 학습자는 일상생활 및 일반적인 주제에 대한 대화 및 담화를 듣고 이해하며, 자신의 생각과 경험을 영어로 표현하는 능력을 기르는 것을 목표로 합니다. 
1. 듣기 영역:
일반적인 주제에 관한 대화나 담화를 듣고 세부 정보와 중심 내용을 파악할 수 있다.
상황에 맞는 적절한 어휘와 문장 구조를 사용하여 내용을 이해할 수 있다.
다양한 속도와 억양으로 제공되는 영어 자료를 듣고 이해할 수 있다.
듣기 자료의 목적과 의도를 파악하고, 필요한 정보를 추출할 수 있다. 
2. 말하기 영역:
일상생활 및 일반적인 주제에 대해 자신의 생각과 경험을 명확하게 표현할 수 있다.
상황에 맞는 적절한 어휘와 문장 구조를 사용하여 유창하게 말할 수 있다.
상대방의 말에 자연스럽게 반응하고, 적절한 의사소통 전략을 활용하여 대화를 이어갈 수 있다.
다양한 발음과 억양으로 명확하게 발음하여 의사소통할 수 있다.
자신의 생각을 논리적으로 전달하고, 다른 사람의 의견을 경청하며 협력적으로 대화할 수 있다. 
추가적으로, 영어회화 교과에서는 다음과 같은 역량 함양을 목표로 합니다:
영어 의사소통 역량:
다양한 정보를 습득하고, 자신의 생각을 창의적으로 표현하며, 다른 사람들과 협력적으로 상호 작용하는 능력 교육과정평가연구에 따르면. 
자기주도적 학습 역량:
영어 학습에 대한 흥미와 관심을 바탕으로 스스로 학습 계획을 세우고 목표를 설정하며, 학습 과정을 관리하는 능력 교육과정평가연구에 따르면. 
문화 간 소통 역량:
다양한 문화에 대한 이해를 바탕으로 국제 사회에서 효과적으로 소통하는 능력 교육과정평가연구에 따르면. 
참고: 2022 개정 교육과정에서는 영어 교과 역량을 강조하며, 학습자의 특성과 성취 단계를 고려한 개별화 수업을 제공하도록 하고 있습니다'

Based on the student's performance, draft the curricular remarks.

Student Name: {{{studentName}}}
Assessment Name: {{{assessmentName}}}
Performance Summary: {{{speakingPerformanceSummary}}}
Strengths: {{{strengths}}}
Areas for Improvement: {{{areasForImprovement}}}

Draft the remarks following the 3-part structure and style as described.

Example structure and tone:
"① 다양한 의사소통 전략을 활용하는 말하기 수업에서, 모둠별 토론 활동과 역할극에 적극적으로 참여하여 과제를 성공적으로 수행함. 몸짓언어에 대한 글을 읽고 토론하는 수업에서, 다문화 친구와 포옹을 하는 것이 불러온 오해에 관한 자신의 경험에 대해 말함. ② 다문화 친구와 허그를 하는 것에 대한 어머니의 지적에, 친구의 배경문화에서는 자연스러운 인사임을 설명하면서 설득하였다는 사례를 들어, 비언어적 요소가 문화를 이해하는 데 큰 영향을 미친다는 소감을 말함. 한국의 관광지로서의 장점을 말하는 역할극에서는 사회자 역을 맡아 지하철 노선도를 보여주면서 대중교통의 편리함에 대해 유창한 영어로 설명하여 큰 호응을 얻음. ③ 다른 친구들이 사례를 말할 때 맞장구를 치며 경청하여 토론의 분위기를 활발하게 만듦. 모둠 활동에서 발표자 선정 시 유창한 영어 실력에도 불구하고 다른 학생을 추천하여 기회를 주고 영어 표현을 작성하는 데 도움을 주는 등 양보심과 배려심이 많은 학생임."

Now, generate the remarks for the given student.
`,
});

const draftCurricularRemarksFlow = ai.defineFlow(
  {
    name: 'draftCurricularRemarksFlow',
    inputSchema: DraftCurricularRemarksInputSchema,
    outputSchema: DraftCurricularRemarksOutputSchema,
  },
  async input => {
    const {output} = await draftCurricularRemarksPrompt(input);
    return output!;
  }
);
