'use server';

/**
 * @fileOverview A flow to analyze a student's handwritten submission (image or PDF) against given criteria (text or file).
 * It provides feedback for both the student and the teacher.
 * 
 * - analyzeHandwritingSubmission - A function that takes student work and criteria and returns analysis.
 * - AnalyzeHandwritingSubmissionInput - The input type for the flow.
 * - AnalyzeHandwritingSubmissionOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { evaluationModels } from '@/lib/types';

const AnalyzeHandwritingSubmissionInputSchema = z.object({
  studentSubmissionUri: z.string().describe(
    "The student's handwritten work as a data URI (image or PDF)."
  ),
  criteriaText: z.string().optional().describe(
    "The evaluation criteria as a text string."
  ),
  criteriaFileUri: z.string().optional().describe(
    "The evaluation criteria as a file data URI (image or PDF)."
  ),
  model: z.enum(evaluationModels).optional().default('gemini-2.5-flash'),
}).refine(data => data.criteriaText || data.criteriaFileUri, {
    message: "At least one of criteriaText or criteriaFileUri must be provided.",
    path: ["criteriaText"], // you can pick any path for the error message
});

export type AnalyzeHandwritingSubmissionInput = z.infer<typeof AnalyzeHandwritingSubmissionInputSchema>;

const AnalyzeHandwritingSubmissionOutputSchema = z.object({
  studentFeedback: z.string().describe('Constructive and encouraging feedback for the student in Korean, presented in Markdown format.'),
  teacherGuidance: z.string().describe('Actionable guidance for the teacher on how to support the student, written in Korean.'),
});
export type AnalyzeHandwritingSubmissionOutput = z.infer<typeof AnalyzeHandwritingSubmissionOutputSchema>;

// Define a separate schema for the prompt's input, excluding the 'model' field.
const PromptInputSchema = AnalyzeHandwritingSubmissionInputSchema.pick({
    studentSubmissionUri: true,
    criteriaText: true,
    criteriaFileUri: true,
});

export async function analyzeHandwritingSubmission(input: AnalyzeHandwritingSubmissionInput): Promise<AnalyzeHandwritingSubmissionOutput> {
  const result = await analyzeHandwritingSubmissionFlow(input);
  return result;
}

const handwritingSubmissionPrompt = ai.definePrompt({
    name: 'handwritingSubmissionPrompt',
    input: { schema: PromptInputSchema }, // Use the schema without the model field
    output: { schema: AnalyzeHandwritingSubmissionOutputSchema },
    prompt: `You are an expert teacher grading a handwritten assignment. Your task is to provide detailed, constructive feedback for both the student and the teacher based on the provided submission and evaluation criteria. All feedback must be in Korean.

### Submission Materials

1.  **Student's Handwritten Submission:**
    {{media url=studentSubmissionUri}}

2.  **Evaluation Criteria:**
    {{#if criteriaText}}
    -   **Text-Based Criteria:** {{{criteriaText}}}
    {{/if}}
    {{#if criteriaFileUri}}
    -   **File-Based Criteria:** {{media url=criteriaFileUri}}
    {{/if}}

---

### Your Tasks

1.  **Analyze the Submission (Strictly):**
    -   Carefully read and understand the student's handwritten work.
    -   **IMPORTANT:** When transcribing or evaluating the text, do NOT correct it based on context. Recognize typos, misspellings, and illegible words exactly as they are. Base your initial assessment on this strict, literal interpretation.
    -   Thoroughly review the provided evaluation criteria.
    -   Compare the student's submission against each criterion based on your strict analysis. Note strengths, weaknesses, and areas of misunderstanding.

2.  **Generate Student Feedback ('studentFeedback'):**
    -   **Format:** Use Markdown for clear formatting (headings, bullet points).
    -   **Tone:** Be encouraging, positive, and constructive.
    -   **Content:**
        -   Start with what the student did well based on the strict analysis.
        -   Explain the areas for improvement (e.g., specific spelling mistakes, unclear letters) with concrete examples from their work.
        -   **Crucially, in a separate section, provide additional feedback considering the likely context.** For example, "비록 'apple'을 'aple'로 썼지만, 전체 문맥을 보니 '사과'를 의미하려 했던 것 같아요. 철자를 다시 한번 확인해보면 더 좋아질 거예요."
        -   Provide clear, actionable advice on how they can improve for next time.

3.  **Generate Teacher Guidance ('teacherGuidance'):**
    -   **Format:** Plain text, professional tone.
    -   **Content:** Provide a concise summary of the student's performance. Highlight key strengths and persistent errors (distinguishing between simple mistakes and potential misunderstandings). Suggest specific teaching strategies or follow-up activities to help this student.

---

Please now generate the feedback in the specified JSON format.
`,
});

const analyzeHandwritingSubmissionFlow = ai.defineFlow(
  {
    name: 'analyzeHandwritingSubmissionFlow',
    inputSchema: AnalyzeHandwritingSubmissionInputSchema,
    outputSchema: AnalyzeHandwritingSubmissionOutputSchema,
  },
  async ({ model, ...input }) => {
    
    const analysisModel = googleAI.model(model || 'gemini-2.5-flash');

    const { output } = await handwritingSubmissionPrompt(input, { model: analysisModel });

    if (!output) {
      throw new Error("The AI model did not return a valid analysis for the submission.");
    }
    return output;
  }
);
