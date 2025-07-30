
'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

/**
 * @fileOverview A flow to analyze a video file from Firebase Storage.
 *
 * This flow takes a file path from Firebase Storage and uses a generative AI model
 * to analyze the video content based on the prompt. It uses the Vertex AI
 * method of passing file URIs.
 */


// Define the input schema for the flow.
const AnalyzeVideoInputSchema = z.object({
  filePath: z.string().describe("The path to the video file in Firebase Storage."),
  mimeType: z.string().describe("The MIME type of the video file (e.g., 'video/mp4')."),
  prompt: z.string().describe("A text prompt describing what to analyze in the video."),
});
type AnalyzeVideoInput = z.infer<typeof AnalyzeVideoInputSchema>;


// Define the output schema for the flow.
type AnalyzeVideoOutput = {
    analysis: string;
}


/**
 * Analyzes a video stored in Firebase Storage.
 * This is the main exported function that UI components will call.
 *
 * @param {z.infer<typeof AnalyzeVideoInputSchema>} input - The input object containing file path, MIME type, and prompt.
 * @returns {Promise<AnalyzeVideoOutput>} A promise that resolves to the analysis result.
 */
export async function analyzeVideo(
  input: AnalyzeVideoInput
): Promise<AnalyzeVideoOutput> {
  return analyzeVideoFlow(input);
}


// The Genkit flow definition.
const analyzeVideoFlow = ai.defineFlow(
  {
    name: 'analyzeVideoFlow',
    inputSchema: AnalyzeVideoInputSchema,
    outputSchema: z.object({
        analysis: z.string().describe("The text-based analysis of the video content."),
    })
  },
  async ({ filePath, mimeType, prompt }) => {
    
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
        throw new Error("Firebase Storage bucket name is not configured in environment variables.");
    }
    
    const gcsUri = `gs://${bucketName}/${filePath}`;

    // Get the specific model instance from the googleAI() plugin
    const model = googleAI.model('gemini-2.5-pro');

    const content = [
      { text: prompt },
      {
        fileData: {
          uri: gcsUri,
          type: mimeType,
        },
      },
    ];
    
    // Call generateContent on the model object, not the ai object
    const response = await model.generateContent(content);
    const analysisText = response.text();

    if (!analysisText) {
      throw new Error("AI model did not return a valid text analysis from the video.");
    }

    return { analysis: analysisText };
  }
);
