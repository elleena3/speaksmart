'use server';
/**
 * @fileOverview A generic flow to analyze a video based on a user's text prompt.
 * This version now uses the Google GenAI SDK directly and passes the GCS URI
 * directly to the model, skipping a separate upload step.
 * 
 * - analyzeVideo - A function that takes a video GCS URI and a prompt, returning a text analysis.
 * - AnalyzeVideoInput - The input type for the flow.
 * - AnalyzeVideoOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';


// The input now expects a direct GCS URI.
const AnalyzeVideoInputSchema = z.object({
  gcsUri: z.string().regex(/^gs:\/\/.*/, "A direct Google Cloud Storage URI is required (gs://...).").describe(
    "A direct Google Cloud Storage URI to a video file. (e.g., gs://bucket-name/path/to/video.mp4)"
  ),
  mimeType: z.string().describe("The MIME type of the video file (e.g., 'video/mp4')."),
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

const analyzeVideoFlow = ai.defineFlow(
  {
    name: 'analyzeVideoFlow',
    inputSchema: AnalyzeVideoInputSchema,
    outputSchema: AnalyzeVideoOutputSchema,
  },
  async (input) => {
    try {
      console.log("Starting video analysis flow with GCS URI:", input.gcsUri);
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      // Note: The model name was corrected to gemini-1.5-pro as per the error log.
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  mimeType: input.mimeType,
                  fileUri: input.gcsUri,
                },
              },
              { text: input.prompt },
            ],
          },
        ],
      });

      const analysisText = result.response.text();

      if (!analysisText) {
        throw new Error("AI model did not return a valid text analysis from the video.");
      }

      console.log("Analysis successful.");
      return { analysis: analysisText };

    } catch (error: any) {
      console.error("An error occurred during the video analysis flow:", error);
      throw new Error(error.message || "An unknown error occurred during video analysis.");
    }
  }
);
