
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
  studentFeedback: z.string().describe('Constructive and encouraging feedback for the student in Korean, based on evaluation criteria, presented in Markdown format.'),
  teacherGuidance: z.string().describe('Actionable guidance for the teacher on how to support the student, written in Korean.'),
});
export type AnalyzeHandwritingSubmissionOutput = z.infer<typeof AnalyzeHandwritingSubmissionOutputSchema>;

// Define a separate schema for the prompt's input, excluding the 'model' field.
const PromptInputSchema = z.object({
  studentSubmissionUris: z.array(z.string()).min(1).describe(
    "The student's handwritten work as an array of data URIs (images or PDFs)."
  ),
  criteriaText: z.string().optional().describe(
    "The evaluation criteria as a text string."
  ),
  criteriaFileUri: z.string().optional().describe(
    "The evaluation criteria as a file data URI (image or PDF)."
  ),
});

export async function analyzeHandwritingSubmission(input: AnalyzeHandwritingSubmissionInput): Promise<AnalyzeHandwritingSubmissionOutput> {
  const result = await analyzeHandwritingSubmissionFlow(input);
  return result;
}

const handwritingSubmissionPrompt = ai.definePrompt({
  name: 'handwritingSubmissionPrompt',
  input: { schema: PromptInputSchema }, // Use the schema without the model field
  output: { schema: AnalyzeHandwritingSubmissionOutputSchema },
  prompt: `You are an expert teacher grading a handwritten assignment. Your task is to extract text, analyze errors, and provide detailed, constructive feedback for both the student and the teacher based on the provided submission and evaluation criteria. All Korean feedback and explanations must use polite and encouraging language.

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

---

### Your Tasks & Output Structure

Follow these steps exactly to fulfill the output schema:

1.  **Raw Transcription (\`rawTranscription\`)**
    - Extract text exactly as written in the image.
    - IMPORTANT: Do NOT auto-correct typos based on context. Recognize typos, misspellings, and illegible words exactly as they are (As-is).

2.  **Spelling Error Analysis (\`errorAnalysis\`)**
    - Identify words from the raw transcription that are misspelled or written incorrectly.
    - For each error, provide the \`original\` word, the \`correction\` (the contextually correct recommended word), and a brief \`reason\` in Korean explaining why it was corrected.

3.  **Polished Version (\`polishedText\`)**
    - Provide a fully corrected, naturally polished version of the raw text where all spelling and grammatical errors are fixed.

4.  **Student Feedback (\`studentFeedback\`)**
    - Compare the polished submission against the Evaluation Criteria (if provided).
    - Format: Use Markdown.
    - Tone: Very encouraging, positive, and constructive.
    - Content: Start with praise for what they did well based on the criteria. Discuss overall areas for improvement. Give actionable advice on how they can improve for next time.

5.  **Teacher Guidance (\`teacherGuidance\`)**
    - Format: Plain text, professional tone.
    - Content: Provide a concise summary of the student's performance. Highlight key strengths and persistent fundamental errors (distinguishing between simple mistakes and potential misunderstandings). Suggest specific teaching strategies or follow-up activities.

Please now generate the structured response in the required JSON format.
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
