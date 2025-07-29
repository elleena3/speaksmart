
'use server';
/**
 * @fileOverview A generic flow to analyze a video based on a user's text prompt.
 * This version now receives a public HTTPS URL (from Firebase Storage's getDownloadURL)
 * and passes it directly to the Gemini API.
 *
 * - analyzeVideo - A function that takes a video URL and a prompt, returning a text analysis.
 * - AnalyzeVideoInput - The input type for the flow.
 * - AnalyzeVideoOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

const AnalyzeVideoInputSchema = z.object({
  gcsUri: z.string().url("A public HTTPS URL to the video file is required.").describe(
    "A public HTTPS URL to a video file, obtained from Firebase Storage getDownloadURL()."
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
      console.log("Starting video analysis flow with HTTPS URL:", input.gcsUri);
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                file_data: {
                  mime_type: input.mimeType,
                  file_uri: input.gcsUri,
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
      // Provide more specific error feedback
      if (error.message && (error.message.includes('permission') || error.message.includes('PermissionDenied'))) {
          throw new Error("Permission denied. Ensure the video URL is publicly accessible. For Firebase Storage, use getDownloadURL() to generate a tokenized URL.");
      }
      if (error.message && (error.message.includes('NotFound') || error.message.includes('404'))) {
           throw new Error("File not found at the provided URL. Please check if the link is correct and still valid.");
      }
      throw new Error(error.message || "An unknown error occurred during video analysis.");
    }
  }
);
