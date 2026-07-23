
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
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import { evaluationModels } from '@/lib/types';

const AnalyzeHandwritingSubmissionInputSchema = z.object({
  studentSubmissionUris: z.array(z.string()).min(1).describe(
    "The student's handwritten work as an array of data URIs (images or PDFs)."
  ),
  criteriaText: z.string().optional().describe(
    "The evaluation criteria as a text string."
  ),
  criteriaFileUri: z.string().optional().describe(
    "The evaluation criteria as a file data URI (image or PDF)."
  ),
  previousGradingContext: z.string().optional().describe(
    "A summary of previously graded students to maintain consistent scoring and strictness across the batch."
  ),
  model: z.enum(evaluationModels).optional().default('googleai/gemini-3.6-flash'),
}).refine(data => data.criteriaText || data.criteriaFileUri, {
  message: "At least one of criteriaText or criteriaFileUri must be provided.",
  path: ["criteriaText"], // you can pick any path for the error message
});

export type AnalyzeHandwritingSubmissionInput = z.infer<typeof AnalyzeHandwritingSubmissionInputSchema>;

const AnalyzeHandwritingSubmissionOutputSchema = z.object({
  rawTranscription: z.string().describe('Exact, literal extraction of the handwritten text. Do not auto-correct.'),
  errorAnalysis: z.array(z.object({
    original: z.string().describe('The misspelled or unclear word exactly as written.'),
    correction: z.string().describe('The contextually correct recommended word.'),
    reason: z.string().describe('Explanation for the correction in Korean.')
  })).describe('List of misspelled words or typos and their contextual corrections.'),
  polishedText: z.string().describe('The fully corrected and naturally polished version of the student text.'),
  score: z.number().optional().describe('The precise numeric score calculated strictly according to the evaluation criteria (e.g. 100).'),
  scoringDetails: z.string().describe('Step-by-step mathematical deduction and justification for the final score, referencing the criteria and previous grading context.'),
  studentFeedback: z.string().describe('Constructive and encouraging feedback for the student in Korean, based on evaluation criteria, presented in Markdown format.'),
  teacherGuidance: z.string().describe('Actionable guidance for the teacher on how to support the student, written in Korean.'),
});
export type AnalyzeHandwritingSubmissionOutput = z.infer<typeof AnalyzeHandwritingSubmissionOutputSchema>;

const PromptInputSchema = z.object({
  studentSubmissionUris: z.array(z.string()).min(1),
  criteriaText: z.string().optional(),
  criteriaFileUri: z.string().optional(),
  previousGradingContext: z.string().optional(),
});

export async function analyzeHandwritingSubmission(input: AnalyzeHandwritingSubmissionInput): Promise<AnalyzeHandwritingSubmissionOutput> {
  const result = await analyzeHandwritingSubmissionFlow(input);
  return result;
}

const handwritingSubmissionPrompt = ai.definePrompt({
  name: 'handwritingSubmissionPrompt',
  input: { schema: PromptInputSchema }, // Use the schema without the model field
  output: { schema: AnalyzeHandwritingSubmissionOutputSchema },
  prompt: `You are a strict and objective expert teacher grading a handwritten assignment. 
Your primary goal is absolute consistency and rigor. You must extract text, analyze errors, calculate a strict numeric score based on the criteria, and provide detailed feedback.
  
All Korean feedback and explanations must use polite and encouraging language.

### Submission Materials

1.  **Student's Handwritten Submission(s):**
    {{#each studentSubmissionUris}}
    {{media url=this}}
    {{/each}}

2.  **Evaluation Criteria:**
    {{#if criteriaText}}
    -   **Text-Based Criteria:** {{{criteriaText}}}
    {{/if}}
    {{#if criteriaFileUri}}
    -   **File-Based Criteria:** {{media url=criteriaFileUri}}
    {{/if}}

{{#if previousGradingContext}}
3.  **Historical Grading Context (Precedents):**
    You must maintain strict consistency with how previous students were graded. Do NOT grade from scratch. Anchor your strictness to these precedents.
    {{{previousGradingContext}}}
{{/if}}

---

### Your Tasks & Output Structure

Follow these steps exactly:

1.  **Raw Transcription (\`rawTranscription\`)**
    - Extract text exactly as written in the image. Do NOT auto-correct typos based on context.

2.  **Spelling Error Analysis (\`errorAnalysis\`)**
    - Identify words from the raw transcription that are misspelled or written incorrectly.
    - Provide the \`original\`, \`correction\`, and a brief \`reason\` in Korean.

3.  **Polished Version (\`polishedText\`)**
    - Provide a fully corrected, naturally polished version.

4.  **Strict Scoring & Justification (\`score\` & \`scoringDetails\`)**
    - If evaluation criteria defines a maximum score (e.g., 100), calculate the final \`score\` deductively.
    - Identify every single error, penalize exactly as the rubric dictates. Do NOT give subjective leniency.
    - If \`previousGradingContext\` is provided, ensure you apply the exact same deduction rules to avoid varying strictness.
    - In \`scoringDetails\`, write the mathematical calculation (e.g., "Max 100, -5 for 'wented', -3 for typo. Result: 92") and explain why it is fair compared to precedents.

5.  **Student Feedback (\`studentFeedback\`)**
    - Write markdown feedback for the student. Start with praise, discuss areas for improvement based on criteria.

6.  **Teacher Guidance (\`teacherGuidance\`)**
    - Plain text summary of performance, highlighting specific weaknesses.

Please generate the structured response matching the JSON schema.
`,
});

const analyzeHandwritingSubmissionFlow = ai.defineFlow(
  {
    name: 'analyzeHandwritingSubmissionFlow',
    inputSchema: AnalyzeHandwritingSubmissionInputSchema,
    outputSchema: AnalyzeHandwritingSubmissionOutputSchema,
  },
  async ({ model, ...input }) => {

    const analysisModel = model || 'googleai/gemini-3.6-flash';

    const { output } = await handwritingSubmissionPrompt(input, { model: analysisModel });

    if (!output) {
      throw new Error("The AI model did not return a valid analysis for the submission.");
    }
    return output;
  }
);
