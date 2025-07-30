
'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { adminStorage } from '@/lib/firebase-admin';

/**
 * @fileOverview A flow to analyze a video file from Firebase Storage.
 *
 * This flow takes a file path from Firebase Storage, downloads it,
 * converts it to a base64 data URI, and then uses a generative AI model
 * to analyze the video content based on the prompt.
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
    
    // 1. Download the file from Firebase Storage into a buffer.
    const bucket = adminStorage.bucket();
    const file = bucket.file(filePath);
    const [buffer] = await file.download();

    // 2. Convert the buffer to a Base64 Data URI.
    const videoDataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

    // 3. Call the model with the Data URI.
    const { text } = await ai.generate({
      model: googleAI.model('gemini-2.5-pro'),
      prompt: [
        { text: prompt },
        { media: { url: videoDataUri } },
      ],
    });

    if (!text) {
      throw new Error("AI model did not return a valid text analysis from the video.");
    }

    return { analysis: text };
  }
);
