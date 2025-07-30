'use server';

/**
 * @fileOverview A flow to analyze a rubric file (image or PDF) and extract evaluation criteria.
 * 
 * - analyzeRubricFile - A function that takes a file and returns structured rubric data.
 * - AnalyzeRubricFileInput - The input type for the flow.
 * - AnalyzeRubricFileOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { AnalyzeRubricFileInputSchema, AnalyzeRubricFileOutputSchema, type AnalyzeRubricFileInput, type AnalyzeRubricFileOutput } from '@/lib/types/ai-schemas';

export async function analyzeRubricFile(input: AnalyzeRubricFileInput): Promise<AnalyzeRubricFileOutput> {
  const result = await analyzeRubricFileFlow(input);
  return result;
}

const rubricAnalysisPrompt = ai.definePrompt({
    name: 'rubricAnalysisPrompt',
    model: googleAI.model('gemini-2.5-pro'),
    input: { schema: AnalyzeRubricFileInputSchema },
    output: { schema: AnalyzeRubricFileOutputSchema },
    prompt: `You are an expert in educational assessment. Your task is to analyze the provided file (image or PDF) which contains a grading rubric. You must extract all evaluation criteria with extreme precision. Do not miss any items, scores, or descriptions.

Here is the rubric file for analysis:
{{media url=fileDataUri}}

Please perform the following steps:
1.  **Identify All Criteria:** Scan the document and identify every distinct evaluation criterion. Each criterion will have a name (e.g., '유창성', '문법').
2.  **Extract Details for Each Criterion:** For each criterion you identified, you must extract the following information:
    -   **name:** The full name of the criterion.
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
    const { output } = await rubricAnalysisPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid rubric analysis.");
    }
    return output;
  }
);
