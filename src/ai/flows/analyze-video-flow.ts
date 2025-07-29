'use server';
/**
 * @fileOverview A generic flow to analyze a video based on a user's text prompt.
 * 
 * - analyzeVideo - A function that takes a video URI from Firebase Storage and a prompt, returning a text analysis.
 * - AnalyzeVideoInput - The input type for the flow.
 * - AnalyzeVideoOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

// The input now expects a direct GCS URI to the file, not a data URI.
const AnalyzeVideoInputSchema = z.object({
  gcsUri: z.string().regex(/^gs:\/\//, "A direct Google Cloud Storage URI is required (gs://...).").describe(
    "A direct Google Cloud Storage URI to a video file. (e.g., gs://bucket-name/path/to/video.mp4)"
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
{{media url=gcsUri}}

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
    // The data URI and content type logic is no longer needed here.
    // The {{media}} helper in the prompt will handle the direct GCS URI.
    const { output } = await videoAnalysisPrompt(input);
    
    if (!output) {
      throw new Error("The AI model did not return a valid video analysis.");
    }
    return output;
  }
);
