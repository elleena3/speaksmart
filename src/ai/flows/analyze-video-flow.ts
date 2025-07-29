
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminStorage } from '@/lib/firebase-admin';
import { Part, FilePart } from '@google/generative-ai';

const AnalyzeVideoInputSchema = z.object({
  filePath: z.string().describe("The path to the video file in Firebase Storage."),
  mimeType: z.string().describe("The MIME type of the video file (e.g., video/mp4)."),
  prompt: z.string().describe("The prompt describing what to analyze in the video."),
});
export type AnalyzeVideoInput = z.infer<typeof AnalyzeVideoInputSchema>;

const AnalyzeVideoOutputSchema = z.object({
  analysis: z.string(),
});
export type AnalyzeVideoOutput = z.infer<typeof AnalyzeVideoOutputSchema>;

export async function analyzeVideo(
  input: AnalyzeVideoInput,
): Promise<AnalyzeVideoOutput> {
  return analyzeVideoFlow(input);
}


const analyzeVideoFlow = ai.defineFlow(
  {
    name: 'analyzeVideoFlow',
    inputSchema: AnalyzeVideoInputSchema,
    outputSchema: AnalyzeVideoOutputSchema,
  },
  async ({ filePath, mimeType, prompt }) => {
    try {
      console.log(`[Video Flow] Starting analysis for file: ${filePath}`);

      // 1. Download the file from Firebase Storage into a buffer
      const bucket = adminStorage.bucket();
      const file = bucket.file(filePath);
      const [buffer] = await file.download();
      
      console.log(`[Video Flow] File downloaded successfully. Size: ${buffer.length} bytes.`);

      // 2. Create a FilePart object for the Generative AI model
      const videoFilePart: FilePart = {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: mimeType,
        },
      };

      // 3. Call the model with the file part and prompt
      const result = await ai.generate({
        model: 'gemini-1.5-pro-preview-0514',
        prompt: [
            { text: prompt },
            { media: videoFilePart }
        ],
      });
      
      const analysisText = result.text;
      if (!analysisText) {
        throw new Error("AI model did not return a valid text analysis from the video.");
      }

      console.log("[Video Flow] Analysis successful.");
      return { analysis: analysisText };

    } catch (error: any) {
      console.error("An error occurred during the video analysis flow:", error);
      throw new Error(error.message || "An unknown error occurred during video analysis.");
    }
  }
);
