'use server';

/**
 * @fileOverview A flow to analyze a generic video file based on a user's text prompt.
 * This flow takes a file path from Firebase Storage.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const AnalyzeVideoInputSchema = z.object({
  filePath: z.string().describe("The path to the video file in Firebase Storage."),
  mimeType: z.string().describe("The MIME type of the video file (e.g., 'video/mp4')."),
  prompt: z.string().describe("A text prompt describing what to analyze in the video."),
});

export const AnalyzeVideoOutputSchema = z.object({
  analysis: z.string().describe("The text-based analysis of the video content."),
});
export type AnalyzeVideoOutput = z.infer<typeof AnalyzeVideoOutputSchema>;

// This is the function that the UI component will call.
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
    outputSchema: AnalyzeVideoOutputSchema,
  },
  async ({ filePath, mimeType, prompt }) => {
    // Note: The Genkit Google AI plugin automatically creates a downloadable URL
    // from the Firebase Storage path. We don't need to manually create a data URI.
    // The `gs://` prefix is implicitly handled.
    const videoUrl = `gs://${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/${filePath}`;

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
