
'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { adminStorage } from '@/lib/firebase-admin';

/**
 * @fileOverview A flow to analyze a video file from Firebase Storage.
 *
 * This flow takes a file path from Firebase Storage and a text prompt,
 * and uses a generative AI model to analyze the video content based on the prompt.
 */


// Define the input schema for the flow.
const AnalyzeVideoInputSchema = z.object({
  filePath: z.string().describe("The path to the video file in Firebase Storage."),
  mimeType: z.string().describe("The MIME type of the video file (e.g., 'video/mp4')."),
  prompt: z.string().describe("A text prompt describing what to analyze in the video."),
});

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
  input: z.infer<typeof AnalyzeVideoInputSchema>
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
    
    // Get the default bucket name directly from the Firebase Admin SDK.
    // This is the most reliable way to get the correct bucket name for the gs:// URI.
    const bucketName = adminStorage.bucket().name;

    if (!bucketName) {
        throw new Error("Firebase Storage bucket name could not be retrieved from the admin SDK.");
    }
    
    // Construct the correct gs:// URI using the retrieved bucket name and the file path.
    const videoUrl = `gs://${bucketName}/${filePath}`;

    const { text } = await ai.generate({
      model: googleAI.model('gemini-2.5-pro'),
      prompt: [
        { text: prompt },
        { media: { url: videoUrl, contentType: mimeType } },
      ],
    });

    if (!text) {
      throw new Error("AI model did not return a valid text analysis from the video.");
    }

    return { analysis: text };
  }
);
