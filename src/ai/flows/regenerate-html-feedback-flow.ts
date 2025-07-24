
'use server';

/**
 * @fileOverview A flow to regenerate feedback from a transcript into a full HTML page.
 * 
 * - regenerateHtmlFeedback - The main function to call for regeneration.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const RegenerateHtmlFeedbackInputSchema = z.object({
  transcript: z.string().describe('The original student transcript.'),
  assessmentType: z.enum(['monologue', 'dialogue']).describe('The type of the assessment.'),
});
export type RegenerateHtmlFeedbackInput = z.infer<typeof RegenerateHtmlFeedbackInputSchema>;

const RegenerateHtmlFeedbackOutputSchema = z.object({
  htmlFeedback: z.string().describe('The full HTML feedback page content.'),
});
export type RegenerateHtmlFeedbackOutput = z.infer<typeof RegenerateHtmlFeedbackOutputSchema>;

export async function regenerateHtmlFeedback(input: RegenerateHtmlFeedbackInput): Promise<RegenerateHtmlFeedbackOutput> {
  const result = await regenerateHtmlFeedbackFlow(input);
  return result;
}


const htmlGenerationPrompt = ai.definePrompt({
    name: 'htmlGenerationPrompt',
    model: googleAI.model('gemini-2.5-flash'),
    input: { schema: RegenerateHtmlFeedbackInputSchema },
    output: { schema: z.object({ html: z.string() }) },
    prompt: `당신은 숙련된 프론트엔드 개발자입니다. 아래 요구사항에 맞춰 AI 영어 회화 능력 분석 보고서를 표시하는 단일 HTML 웹페이지를 제작해 주세요.

1. 최종 목표:
사용자의 영어 회화 능력 분석 결과를 보여주는, 시각적으로 깔끔하고 반응형으로 동작하는 웹페이지를 생성합니다. 결과물은 별도의 파일 없이 하나의 HTML 파일로만 구성되어야 합니다.

2. 콘텐츠 구조 (HTML):

전체 제목: 페이지 상단에 <h1> 태그를 사용하여 "📊 AI 영어회화 상세 분석" 제목을 추가합니다.

분석 항목: 아래 분석 항목들을 각각의 섹션으로 만듭니다. 각 항목은 <div class="category-card">로 감싸주세요.
- 🗣️ 유창성 (Fluency)
- 🎤 발음 및 억양 (Pronunciation & Intonation)
- ✍️ 문법 (Grammar)
- 📚 어휘 (Vocabulary)
{{#if (eq assessmentType "dialogue")}}
- 🤝 내용 이해 및 상호작용 (Comprehension & Interaction)
{{/if}}

항목별 헤더: 각 분석 항목 카드 상단에는 항목명(<h2>)과 점수(<span>)를 표시합니다. 점수는 "📈 점수: X / 5점" 형식입니다.

상세 내용: 각 항목 카드 내부에 "잘한 점"과 "개선점"을 나란히 비교할 수 있는 두 개의 박스를 만듭니다.
- "👍 잘한 점" 박스 (<div class="detail-box good-points">)
- "💡 개선점" 박스 (<div class="detail-box improvement-points">)
각 박스 안에는 소제목(<h3>)과 <ul>, <li> 태그를 사용하여 상세 내용을 목록으로 정리합니다.

3. 디자인 및 스타일 (CSS):
레이아웃:
- Flexbox를 사용하여 "잘한 점"과 "개선점" 박스를 가로로 배치합니다.
- 전체 콘텐츠는 페이지 중앙에 오도록 하고, max-width: 900px를 설정하여 가독성을 확보합니다.

반응형 디자인:
- 필수: 화면 너비가 768px 이하가 되면, "잘한 점"과 "개선점" 박스가 세로로 쌓이도록 미디어 쿼리(@media)를 설정해야 합니다.

색상 및 효과:
- 전체 페이지 배경은 연한 회색 (#f4f7f9), 콘텐츠 카드는 흰색 (#ffffff)으로 지정합니다.
- "잘한 점" 박스: 긍정적 느낌을 주는 연한 녹색 계열(background-color: #e8f5e9, border-left: 5px solid #4caf50)로 스타일링합니다.
- "개선점" 박스: 주목도를 높이는 연한 주황색 계열(background-color: #fff3e0, border-left: 5px solid #ff9800)로 스타일링합니다.
- 각 분석 항목 카드에 마우스를 올리면 그림자(box-shadow) 효과가 살짝 나타나도록 하여 상호작용성을 높여주세요.

폰트: font-family는 Apple과 Windows 시스템에서 모두 깔끔하게 보이는 기본 산세리프 폰트 (예: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)로 설정합니다.

4. 기술 요구사항:
- 모든 CSS 코드는 HTML 파일 내 <head> 섹션의 <style> 태그 안에 포함시켜야 합니다.
- 외부 CSS 라이브러리(Bootstrap, Tailwind CSS 등)는 사용하지 않습니다.
- 코드의 각 부분에 주석을 달아 어떤 역할을 하는지 설명해주세요.

[사용자 발화 내용]
{{{transcript}}}

### 평가 기준 루브릭 (Evaluation Rubric)
아래의 평가 기준을 반드시 준수하여 각 항목을 평가하시오. 각 항목은 고유한 평가 기준을 가지며, 점수별 설명에 따라 정확하게 평가해야 합니다.

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

{{#if (eq assessmentType "dialogue")}}
[평가 항목: 내용 이해 및 상호작용 (Comprehension & Interaction)]
5점 (최상): 상대방의 말을 완벽하게 이해하고 대화의 흐름을 주도함.
4점 (상): 대부분의 말을 어려움 없이 이해하고 적절히 반응함.
3점 (중): 간단한 문장은 이해하나, 길거나 빠른 문장은 이해에 어려움을 겪음.
2점 (하): 아주 간단한 질문만 이해하고, 대화에 거의 참여하지 못함.
1점 (최하): 상대방의 말을 거의 이해하지 못함.
{{/if}}

이제 위의 모든 요구사항을 반영하여 완전한 단일 HTML 파일을 생성해주세요.
`,
});

const regenerateHtmlFeedbackFlow = ai.defineFlow(
  {
    name: 'regenerateHtmlFeedbackFlow',
    inputSchema: RegenerateHtmlFeedbackInputSchema,
    outputSchema: RegenerateHtmlFeedbackOutputSchema,
  },
  async (input) => {
    const { output } = await htmlGenerationPrompt(input, {
        helpers: {
            eq: (a: string, b: string) => a === b,
        },
    });
    if (!output?.html) {
      throw new Error("The AI model did not return valid HTML feedback.");
    }
    return { htmlFeedback: output.html };
  }
);
