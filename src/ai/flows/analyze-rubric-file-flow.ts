'use server';
import { requireTeacher } from '@/lib/auth-guard';

/**
 * @fileOverview A flow to analyze a rubric file (image or PDF) and extract evaluation criteria.
 * 
 * - analyzeRubricFile - A function that takes a file and returns structured rubric data.
 * - AnalyzeRubricFileInput - The input type for the flow.
 * - AnalyzeRubricFileOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import { AnalyzeRubricFileInputSchema, AnalyzeRubricFileOutputSchema, type AnalyzeRubricFileInput, type AnalyzeRubricFileOutput } from '@/lib/types/ai-schemas';

/** 모델 접두사별로 있어야 하는 환경 변수. 없으면 플러그인 자체가 등록되지 않습니다. */
function missingKeyFor(model: string): string | null {
  if (model.startsWith('anthropic/') && !process.env.ANTHROPIC_API_KEY) return 'ANTHROPIC_API_KEY';
  if (model.startsWith('openai/') && !process.env.OPENAI_API_KEY) return 'OPENAI_API_KEY';
  if (model.startsWith('googleai/') && !(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY)) {
    return 'GOOGLE_GENAI_API_KEY';
  }
  return null;
}

export async function analyzeRubricFile(
  input: AnalyzeRubricFileInput
): Promise<AnalyzeRubricFileOutput & { unavailableReason?: string }> {
  // 서버 액션은 인증 없이 호출될 수 있어 호출자를 먼저 확인합니다.
  await requireTeacher();

  // 키가 없으면 Genkit 은 "Model ... not found" 를 던지는데,
  // 프로덕션은 서버 액션이 던진 메시지를 감춰서 화면에는 원인이 안 뜹니다.
  // 그래서 던지지 않고 결과에 담아 돌려줍니다.
  const missing = input.model ? missingKeyFor(input.model) : null;
  if (missing) {
    return {
      criteria: [],
      unavailableReason:
        `이 서버에 ${missing} 가 설정되어 있지 않아 ${input.model} 을(를) 쓸 수 없습니다. ` +
        `(실행 환경: ${process.env.VERCEL_ENV ?? 'local'}) ` +
        `다른 모델을 고르시거나 관리자에게 키 설정을 요청하십시오.`,
    };
  }

  const result = await analyzeRubricFileFlow(input);
  return result;
}

const rubricAnalysisPrompt = ai.definePrompt({
    name: 'rubricAnalysisPrompt',
    // 교사가 고르지 않았을 때의 기본값. 호출 시 input.model 로 덮어씁니다.
    model: 'googleai/gemini-3.1-pro-preview',
    input: { schema: AnalyzeRubricFileInputSchema },
    output: { schema: AnalyzeRubricFileOutputSchema },
    prompt: `You are an expert in educational assessment. Your task is to analyze the provided file (image or PDF) which contains a grading rubric. You must extract all evaluation criteria with extreme precision. Do not miss any items, scores, or descriptions.

Here is the rubric file for analysis:
{{media url=fileDataUri}}

Please perform the following steps:
1.  **Identify All Criteria:** Scan the document and identify every distinct evaluation criterion. Each criterion will have a name (e.g., '유창성', '문법').
2.  **Extract Details for Each Criterion:** For each criterion you identified, you must extract the following information:
    -   **name:** The full name of the criterion, in the document's own language. Do NOT translate it, and do NOT append the score to it — write '내용의 적절성', never '내용의 적절성 (30점)'. The score belongs in maxScore.
    -   **maxScore:** The highest possible score for that criterion.
    -   **details:** An array containing every single performance level description. For each level, you MUST extract:
        -   **score:** The integer score for that level.
        -   **description:** The full, exact text describing what is required to achieve that score.
3.  **Ensure Completeness:** It is critical that you capture every single criterion and every single detail within them. Double-check your work to ensure nothing is omitted.
4.  **Format the Output:** Return the full list of extracted criteria in the specified JSON array format. If the file contains no recognizable rubric, return an empty array.
`,
});

const analyzeRubricFileFlow = ai.defineFlow(
  {
    name: 'analyzeRubricFileFlow',
    inputSchema: AnalyzeRubricFileInputSchema,
    outputSchema: AnalyzeRubricFileOutputSchema,
  },
  async (input) => {
    // 교사가 고른 모델이 있으면 그것으로 부릅니다. 없으면 definePrompt 의 기본값.
    const { output } = await rubricAnalysisPrompt(
      input,
      input.model ? { model: input.model } : undefined
    );
    if (!output) {
      throw new Error("The AI model did not return a valid rubric analysis.");
    }
    return output;
  }
);
