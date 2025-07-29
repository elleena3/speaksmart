
'use server';
/**
 * @fileOverview A generic flow to analyze a video based on a user's text prompt.
 * This version now uses the Google GenAI SDK directly for video processing
 * to align with the required two-step upload/process flow for large files.
 * 
 * - analyzeVideo - A function that takes a video GCS URI and a prompt, returning a text analysis.
 * - AnalyzeVideoInput - The input type for the flow.
 * - AnalyzeVideoOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';


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
      
      // Step 1: Upload the file to the Gemini API Files service using the correct function name
      console.log("Uploading file to Gemini Files service...");
      const uploadResult = await genAI.files.upload({
          path: input.gcsUri,
          mimeType: input.mimeType,
      });

      console.log("File uploaded successfully. URI:", uploadResult.file.uri);

      // Step 2: Generate content using the uploaded file's URI
      const contents: Part[] = [
        {
          fileData: {
            mimeType: uploadResult.file.mimeType,
            fileUri: uploadResult.file.uri,
          },
        },
        { text: input.prompt },
      ];

      console.log("Generating content with gemini-2.5-pro...");
      const generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
      const result = await generativeModel.generateContent({
        contents,
      });
      
      const response = result.response;
      const analysisText = response.text();

      if (!analysisText) {
          throw new Error("AI model did not return a valid text analysis from the video.");
      }

      console.log("Analysis successful.");
      return { analysis: analysisText };

    } catch (error: any) {
        console.error("An error occurred during the video analysis flow:", error);
        
        // Check for specific error messages to provide clearer feedback
        if (error.message && error.message.includes('media file is not available')) {
            throw new Error('The video file could not be accessed by the AI. Please check file permissions in Google Cloud Storage.');
        }
        if (error.message && error.message.includes('unsupported')) {
             throw new Error('The provided video format or codec is not supported by the AI model.');
        }

        throw new Error(error.message || "An unknown error occurred during video analysis.");
    }
  }
);
