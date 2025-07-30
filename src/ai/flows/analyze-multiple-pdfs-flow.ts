'use server';

/**
 * @fileOverview A flow to analyze multiple PDF files individually.
 * It takes an array of PDFs and returns an analysis for each one.
 * 
 * - analyzeMultiplePdfs - The main function to call for this feature.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const FileInputSchema = z.object({
  fileName: z.string().describe("The name of the PDF file."),
  dataUri: z.string().describe("The PDF file content as a data URI."),
});

const AnalyzeMultiplePdfsInputSchema = z.object({
  files: z.array(FileInputSchema).describe("An array of PDF files to analyze."),
  prompt: z.string().describe("The analysis prompt to apply to each PDF."),
});
export type AnalyzeMultiplePdfsInput = z.infer<typeof AnalyzeMultiplePdfsInputSchema>;

const AnalysisResultSchema = z.object({
  fileName: z.string(),
  analysis: z.string().optional(),
  error: z.string().optional(),
});

const AnalyzeMultiplePdfsOutputSchema = z.object({
  results: z.array(AnalysisResultSchema),
});
export type AnalyzeMultiplePdfsOutput = z.infer<typeof AnalyzeMultiplePdfsOutputSchema>;

export async function analyzeMultiplePdfs(input: AnalyzeMultiplePdfsInput): Promise<AnalyzeMultiplePdfsOutput> {
  return analyzeMultiplePdfsFlow(input);
}

const analyzePdfPrompt = ai.definePrompt({
    name: 'analyzeSinglePdfForMulti',
    model: googleAI.model('gemini-2.5-pro'),
    input: { schema: z.object({ prompt: z.string(), fileUri: z.string() }) },
    prompt: `You are an expert document analyst. Analyze the provided PDF document based on the user's request.

User's Request:
"{{{prompt}}}"

Document for Analysis:
{{media url=fileUri}}

Provide a clear and concise analysis based *only* on the content of the document.
`,
});


const analyzeMultiplePdfsFlow = ai.defineFlow(
  {
    name: 'analyzeMultiplePdfsFlow',
    inputSchema: AnalyzeMultiplePdfsInputSchema,
    outputSchema: AnalyzeMultiplePdfsOutputSchema,
  },
  async ({ files, prompt }) => {
    
    const analysisPromises = files.map(async (file) => {
        try {
            const { text } = await analyzePdfPrompt({
                prompt: prompt,
                fileUri: file.dataUri,
            });

            if (!text) {
              throw new Error("AI model did not return a valid text analysis.");
            }

            return {
                fileName: file.fileName,
                analysis: text,
            };
        } catch (error: any) {
             console.error(`Error analyzing file ${file.fileName}:`, error);
             return {
                 fileName: file.fileName,
                 error: `[${file.fileName}] 분석 실패: ${error.message || '알 수 없는 오류'}`,
             };
        }
    });

    const results = await Promise.all(analysisPromises);
    
    return { results };
  }
);
