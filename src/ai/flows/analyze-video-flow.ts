
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
  fileName: z.string().describe(
    "The original file name of the video, including its extension."
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

const PromptInputSchema = z.object({
    videoDataUri: z.string(),
    prompt: z.string(),
    contentType: z.string(), // Explicitly define contentType for the prompt
});

const videoAnalysisPrompt = ai.definePrompt({
    name: 'videoAnalysisPrompt',
    model: googleAI.model('gemini-2.5-pro'),
    input: { schema: PromptInputSchema },
    output: { schema: AnalyzeVideoOutputSchema },
    prompt: `You are an expert video analyst. Analyze the provided video file based on the user's specific request. Provide a detailed, text-based response that directly addresses the user's prompt.

### User Request:
"{{{prompt}}}"

### Video for Analysis:
{{media url=videoDataUri contentType=contentType}}

Please provide your analysis now.
`,
});

const getContentTypeFromFileName = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'mp4':
            return 'video/mp4';
        case 'mov':
            return 'video/quicktime';
        case 'webm':
            return 'video/webm';
        // Add other video types as needed
        default:
            throw new Error(`지원하지 않는 동영상 파일 확장자입니다: .${extension}`);
    }
}


const analyzeVideoFlow = ai.defineFlow(
  {
    name: 'analyzeVideoFlow',
    inputSchema: AnalyzeVideoInputSchema,
    outputSchema: AnalyzeVideoOutputSchema,
  },
  async (input) => {
    
    const contentType = getContentTypeFromFileName(input.fileName);

    const { output } = await videoAnalysisPrompt({
      videoDataUri: input.videoDataUri,
      prompt: input.prompt,
      contentType: contentType,
    });
    
    if (!output) {
      throw new Error("The AI model did not return a valid video analysis.");
    }
    return output;
  }
);
