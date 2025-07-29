
'use server';
/**
 * @fileOverview A generic flow to analyze a video based on a user's text prompt.
 * This version now correctly handles file uploads by first downloading from a Firebase GCS URI
 * and then uploading it to the Gemini Files API before analysis.
 *
 * - analyzeVideo - A function that takes a video GCS URI and a prompt, returning a text analysis.
 * - AnalyzeVideoInput - The input type for the flow.
 * - AnalyzeVideoOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

// The input still expects a GCS URI from the client upload.
const AnalyzeVideoInputSchema = z.object({
  gcsUri: z.string().regex(/^gs:\/\/.*/, "A Google Cloud Storage URI is required (gs://...).").describe(
    "A Google Cloud Storage URI to a video file. (e.g., gs://bucket-name/path/to/video.mp4)"
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
      console.log("Starting video analysis flow for GCS URI:", input.gcsUri);
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      
      // Step 1: Upload the file from GCS to the Gemini API
      console.log("Uploading file to Gemini Files API...");
      const uploadResult = await genAI.files.upload({
        file: {
          uri: input.gcsUri,
          mimeType: input.mimeType,
        },
        // Optional: provide a display name
        displayName: `video-analysis-${Date.now()}`,
      });
      console.log("File upload successful. URI:", uploadResult.file.uri);
      
      // Step 2: Use the uploaded file's URI to generate content
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      console.log("Generating content with gemini-1.5-pro...");
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  mimeType: uploadResult.file.mimeType,
                  fileUri: uploadResult.file.uri,
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
      if (error.message && error.message.includes('permission')) {
          throw new Error("Permission denied. The AI model may not have access to the provided GCS bucket. Please check bucket permissions.");
      }
      if (error.message && error.message.includes('NotFound')) {
           throw new Error("File not found at the provided GCS URI. Please check the path.");
      }
      throw new Error(error.message || "An unknown error occurred during video analysis.");
    }
  }
);
