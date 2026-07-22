
'use server';
/**
 * @fileOverview A flow to analyze a student's presentation video.
 * It evaluates content, language competence, and delivery based on the video and optional supplementary materials.
 * 
 * - analyzePresentationVideo - A function that takes a video and other data, returning a detailed analysis.
 * - AnalyzePresentationVideoInput - The input type for the flow.
 * - AnalyzePresentationVideoOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const FeedbackSchema = z.object({
  score: z.number().int().min(0).max(100).describe("The score for this category, from 0 to 100."),
  feedback: z.string().describe("Specific, constructive feedback for this category in Korean, including examples from the presentation."),
});

const AnalyzePresentationVideoInputSchema = z.object({
  videoDataUri: z.string().describe(
    "A video file of the student's presentation, as a data URI."
  ),
  presentationFileUri: z.string().optional().describe(
    "An optional presentation file (e.g., PDF, PPTX) as a data URI."
  ),
  customCriteria: z.string().optional().describe(
    "Optional custom evaluation criteria provided by the teacher."
  ),
});
export type AnalyzePresentationVideoInput = z.infer<typeof AnalyzePresentationVideoInputSchema>;

const AnalyzePresentationVideoOutputSchema = z.object({
  overallScore: z.number().int().min(0).max(100).describe("The final, weighted overall score for the presentation."),
  content: FeedbackSchema.describe("Evaluation of the presentation's content."),
  languageCompetence: FeedbackSchema.describe("Evaluation of the student's language competence."),
  delivery: FeedbackSchema.describe("Evaluation of the student's delivery and attitude."),
  overallFeedback: z.string().describe("A summary of the overall performance and final constructive advice in Korean."),
});
export type AnalyzePresentationVideoOutput = z.infer<typeof AnalyzePresentationVideoOutputSchema>;


export async function analyzePresentationVideo(input: AnalyzePresentationVideoInput): Promise<AnalyzePresentationVideoOutput> {
  const result = await analyzePresentationVideoFlow(input);
  return result;
}

const presentationAnalysisPrompt = ai.definePrompt({
  name: 'presentationAnalysisPrompt',
  model: googleAI.model('gemini-3.1-pro-preview'),
  input: { schema: AnalyzePresentationVideoInputSchema },
  output: { schema: AnalyzePresentationVideoOutputSchema },
  prompt: `You are an expert AI teacher evaluating a student's English presentation or conversation performance. Your task is to provide a comprehensive, multi-faceted evaluation based on a video, optional presentation materials, and specific criteria. All feedback must be in Korean.

### Provided Materials for Evaluation:
1.  **Student's Presentation Video:**
    {{media url=videoDataUri}}

{{#if presentationFileUri}}
2.  **Student's Presentation Document (PDF/PPTX):**
    {{media url=presentationFileUri}}
{{/if}}

### Core Evaluation Framework:
You must evaluate the student's performance across three main categories: **Content, Language Competence, and Delivery**. Use the detailed criteria below for each category.

---

#### 1. 내용 (Content): 충실성 및 논리성
-   **주제 적합성 및 이해도:** 제시된 주제나 상황을 정확하게 이해하고 있는가?
-   **내용의 충실성 및 완성도:** 전달하고자 하는 내용이 풍부하고 짜임새 있게 구성되었는가?
-   **논리적 구성:** 서론, 본론, 결론의 구조가 명확하며, 내용의 흐름이 자연스럽고 논리적인가?
-   **창의성:** 자신만의 생각이나 아이디어를 독창적으로 표현했는가? (가산점 요소)

#### 2. 언어적 능력 (Language Competence): 정확성 및 유창성
-   **정확성 (Accuracy):**
    -   **문법 (Grammar):** 문법적 오류 없이 정확한 문장을 구사하는가?
    -   **어휘 (Vocabulary):** 주제와 상황에 맞는 적절하고 다양한 어휘를 사용하는가?
-   **유창성 (Fluency):**
    -   **발음 및 억양 (Pronunciation & Intonation):** 명확한 발음과 자연스러운 억양을 구사하는가?
    -   **속도 및 망설임 (Speed & Hesitation):** 너무 빠르거나 느리지 않고, 불필요한 멈춤 없이 자연스럽게 말하는가?

#### 3. 발표 태도 (Delivery): 전달 효과성
-   **자신감 및 태도:** 자신감 있는 목소리와 바른 자세를 유지하는가?
-   **시선 처리 (Eye Contact):** 카메라(청중)와 적절하게 시선을 맞추며 소통하는가?
-   **목소리 크기 및 표현력:** 목소리 크기가 적절하며, 내용에 따라 톤에 변화를 주어 효과적으로 전달하는가?
-   **시간 관리:** 영상 길이를 고려했을 때, 발표 시간을 효과적으로 활용했는가?

---

{{#if customCriteria}}
### Teacher's Custom Criteria:
In addition to the core framework, pay special attention to the following criteria provided by the teacher:
"{{{customCriteria}}}"
{{/if}}

### IMPORTANT ANALYSIS INSTRUCTION:
If the video appears to be a casual conversation, a non-standard activity, or does not fit a formal presentation structure, you MUST **prioritize the teacher's custom criteria** as the main evaluation framework. In this case, adapt your analysis of Content, Language, and Delivery to reflect the custom criteria. If no custom criteria are provided for such a video, evaluate based on general conversational abilities.

### Your Output Formatting Tasks:
1.  **Category Scoring:** Provide a base score (0-100) for Content, Language Competence, and Delivery.
2.  **Category Feedback Writing (Markdown):** 
    -   For **Content (내용)**: You MUST include an evaluation of the Opening (도입부) and Closing (마무리). Did they grab the audience's attention? Provide a concrete rewrite suggestion for a better opening or closing script.
    -   For **Language Competence (언어)** & **Delivery (발표 태도)**: You MUST use **[MM:SS] timestamp format** to point out specific errors or excellent moments (e.g., "[00:45] - 말 속도가 너무 빨라짐"). Give actionable solutions for these timestamped issues.
3.  **Overall Score:** Calculate a final weighted score: Content (40%), Language (40%), Delivery (20%).
4.  **Overall Feedback (\`overallFeedback\`) (Markdown):** 
    -   Must strictly follow this structure:
        -   **[발표 종합 평가]**: Summarize exactly 2 strengths (강점 2가지) and 2 areas for improvement (개선점 2가지).
        -   **[전달력 핵심 팁]**: Provide exactly 3 actionable, core advice points regarding voice tone, intonation, gestures, and speed.

5.  **Return JSON:** Format the complete analysis strictly in the specified JSON format.
`,
});

const analyzePresentationVideoFlow = ai.defineFlow(
  {
    name: 'analyzePresentationVideoFlow',
    inputSchema: AnalyzePresentationVideoInputSchema,
    outputSchema: AnalyzePresentationVideoOutputSchema,
  },
  async (input) => {
    const { output } = await presentationAnalysisPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid presentation analysis.");
    }
    return output;
  }
);
