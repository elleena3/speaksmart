'use server';
/**
 * @fileOverview A generic flow to analyze a video based on a user's text prompt.
 * 
 * - analyzeVideo - A function that takes a video and a prompt, returning a text analysis.
 * - AnalyzeVideoInput - The input type for the flow.
 * - AnalyzeVideoOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const AnalyzeVideoInputSchema = z.object({
  videoDataUri: z.string().describe(
    "A video file to be analyzed, as a data URI."
  ),
  prompt: z.string().describe(
    "The user's specific request or question about the video."
  ),
});
export type AnalyzeVideoInput = z.infer<typeof AnalyzeVideoInputSchema>;

const AnalyzeVideoOutputSchema = z.object({
  analysis: z.string().describe("The AI's text-based analysis of the video based on the user's prompt."),
});
export type AnalyzeVideoOutput = z.infer<typeof AnalyzeVideoOutputSchema>;

export async function analyzeVideo(input: AnalyzeVideoInput): Promise<AnalyzeVideoOutput> {
  const result = await analyzeVideoFlow(input);
  return result;
}

const videoAnalysisPrompt = ai.definePrompt({
    name: 'videoAnalysisPrompt',
    model: googleAI.model('gemini-2.5-pro'),
    input: { schema: AnalyzeVideoInputSchema },
    output: { schema: AnalyzeVideoOutputSchema },
    prompt: `You are an expert video analyst. Analyze the provided video file based on the user's specific request. Provide a detailed, text-based response that directly addresses the user's prompt.

### User Request:
"{{{prompt}}}"

### Video for Analysis:
{{media url=videoDataUri}}

Please provide your analysis now.
`,
});

const analyzeVideoFlow = ai.defineFlow(
  {
    name: 'analyzeVideoFlow',
    inputSchema: AnalyzeVideoInputSchema,
    outputSchema: AnalyzeVideoOutputSchema,
  },
  async (input) => {
    const { output } = await videoAnalysisPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid video analysis.");
    }
    return output;
  }
);
