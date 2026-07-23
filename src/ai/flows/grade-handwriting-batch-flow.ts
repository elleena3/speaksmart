'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { evaluationModels } from '@/lib/types';
import { AnalyzeHandwritingSubmissionOutput } from './analyze-handwriting-submission-flow';

const GradeHandwritingBatchInputSchema = z.object({
    studentSubmissions: z.array(z.object({
        id: z.string(),
        fileName: z.string(),
        rawText: z.string(),
        previousHistoryContext: z.string().optional(),
    })).min(1).describe("Chunk of student OCR texts to grade. Max size should be 5-10 for token limits."),
    criteriaText: z.string().optional(),
    criteriaFileUri: z.string().optional(),
    model: z.enum(evaluationModels).optional().default('googleai/gemini-3.6-flash'),
});

export type GradeHandwritingBatchInput = z.infer<typeof GradeHandwritingBatchInputSchema>;

// We use the same output item structure as before, but wrapped in an array map
const BatchStudentResultSchema = z.object({
    id: z.string().describe("The ID of the student submission provided in the input"),
    errorAnalysis: z.array(z.object({
        original: z.string().describe('The misspelled or unclear word exactly as written.'),
        correction: z.string().describe('The contextually correct recommended word.'),
        reason: z.string().describe('Explanation for the correction in Korean.')
    })).describe('List of misspelled words or typos and their contextual corrections.'),
    polishedText: z.string().describe('The fully corrected and naturally polished version of the student text.'),
    scoringDetails: z.string().describe('Step-by-step mathematical deduction and justification for the final score, referencing the criteria and history.'),
    score: z.number().optional().describe('The precise numeric score calculated strictly according to the evaluation criteria (e.g. 100).'),
    studentFeedback: z.string().describe('Constructive and encouraging feedback for the student in Korean, based on evaluation criteria, presented in Markdown format.'),
    teacherGuidance: z.string().describe('Actionable guidance for the teacher on how to support the student, written in Korean.'),
});

const GradeHandwritingBatchOutputSchema = z.object({
    results: z.array(BatchStudentResultSchema)
});

export type GradeHandwritingBatchOutput = z.infer<typeof GradeHandwritingBatchOutputSchema>;

export async function gradeHandwritingBatch(input: GradeHandwritingBatchInput): Promise<GradeHandwritingBatchOutput> {
    const result = await gradeHandwritingBatchFlow(input);
    return result;
}

const gradeHandwritingBatchPrompt = ai.definePrompt({
    name: 'gradeHandwritingBatchPrompt',
    input: { schema: GradeHandwritingBatchInputSchema },
    output: { schema: GradeHandwritingBatchOutputSchema },
    config: { temperature: 0 },
    prompt: `You are a strict and objective expert teacher grading a batch of handwritten assignments. 
Your primary goal is absolute consistency and rigor. You must analyze errors, calculate a strict numeric score, and provide detailed feedback for EACH student provided in the batch.

### Evaluation Criteria (Static across all students):
{{#if criteriaText}}
-   **Text-Based Criteria:** {{{criteriaText}}}
{{/if}}
{{#if criteriaFileUri}}
-   **File-Based Criteria:** {{media url=criteriaFileUri}}
{{/if}}

---

### Student Submissions (JSON Array):
The following are the raw OCR extractions of the students' handwriting. 
For each student, evaluate their \`rawText\`. If they have \`previousHistoryContext\`, you MUST perform a comparative 2nd-stage grading (compare explicit fixed/new errors based on history).

{{#each studentSubmissions}}
=== STUDENT ID: {{this.id}} (File: {{this.fileName}}) ===
[Raw OCR Text]:
{{{this.rawText}}}

{{#if this.previousHistoryContext}}
[Historical Context / 2nd-Stage Grading Requirement]:
{{{this.previousHistoryContext}}}
{{/if}}
==========================================

{{/each}}


### Your Tasks & Output Structure

For EACH student ID, you must output an object with:
1.  **errorAnalysis**: List typos and incorrect words found in the text.
2.  **polishedText**: A naturally corrected version of their text.
3.  **scoringDetails**: Logically and mathematically deduct points based on errors and criteria. Write this FIRST before the final score to ensure logical reasoning.
4.  **score**: Final numeric score. Do not be subjectively lenient.
5.  **studentFeedback**: Feedback in Korean markdown. If they have historical context, include a "과거 제출물과의 비교" section praising improvements.
6.  **teacherGuidance**: Brief guidance for the teacher.

Generate an array of these objects matching the JSON schema.
`,
});

const gradeHandwritingBatchFlow = ai.defineFlow(
    {
        name: 'gradeHandwritingBatchFlow',
        inputSchema: GradeHandwritingBatchInputSchema,
        outputSchema: GradeHandwritingBatchOutputSchema,
    },
    async ({ model, ...input }) => {
        const analysisModel = model || 'googleai/gemini-3.1-pro-preview';

        const { output } = await gradeHandwritingBatchPrompt({ ...input, model: analysisModel }, { model: analysisModel });

        if (!output) {
            throw new Error("The AI model did not return a valid analysis for the batch.");
        }
        return output;
    }
);
