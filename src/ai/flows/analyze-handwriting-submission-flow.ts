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
});
export type AnalyzeHandwritingSubmissionInput = z.infer<typeof AnalyzeHandwritingSubmissionInputSchema>;

const AnalyzeHandwritingSubmissionOutputSchema = z.object({
  studentFeedback: z.string().describe('Constructive and encouraging feedback for the student in Korean, presented in Markdown format.'),
  teacherGuidance: z.string().describe('Actionable guidance for the teacher on how to support the student, written in Korean.'),
});
export type AnalyzeHandwritingSubmissionOutput = z.infer<typeof AnalyzeHandwritingSubmissionOutputSchema>;


export async function analyzeHandwritingSubmission(input: AnalyzeHandwritingSubmissionInput): Promise<AnalyzeHandwritingSubmissionOutput> {
  const result = await analyzeHandwritingSubmissionFlow(input);
  return result;
}

const handwritingSubmissionPrompt = ai.definePrompt({
    name: 'handwritingSubmissionPrompt',
    model: googleAI.model('gemini-2.5-pro'),
    input: { schema: AnalyzeHandwritingSubmissionInputSchema },
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
    {{#unless criteriaText}}{{#unless criteriaFileUri}}
    -   **Criteria:** No specific criteria provided. Please evaluate based on general legibility, neatness, and completeness.
    {{/unless}}{{/unless}}

---

### Your Tasks

1.  **Analyze the Submission:**
    -   Carefully read and understand the student's handwritten work.
    -   Thoroughly review the provided evaluation criteria.
    -   Compare the student's submission against each criterion. Note strengths, weaknesses, and areas of misunderstanding.

2.  **Generate Student Feedback ('studentFeedback'):**
    -   **Format:** Use Markdown for clear formatting (headings, bullet points).
    -   **Tone:** Be encouraging, positive, and constructive.
    -   **Content:** Start with what the student did well. Then, explain the areas for improvement with specific examples from their work. Provide clear, actionable advice on how they can improve for next time. Avoid overly harsh criticism.

3.  **Generate Teacher Guidance ('teacherGuidance'):**
    -   **Format:** Plain text, professional tone.
    -   **Content:** Provide a concise summary of the student's performance. Highlight key strengths and persistent errors. Suggest specific teaching strategies or follow-up activities to help this student. For example, "The student shows a good understanding of X but struggles with Y. Consider a mini-lesson on Z or providing a worksheet focusing on Y."

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
  async (input) => {
    const { output } = await handwritingSubmissionPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid analysis for the submission.");
    }
    return output;
  }
);
