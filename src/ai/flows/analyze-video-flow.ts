
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

type AnalyzeVideoInput = z.infer<typeof AnalyzeVideoInputSchema>;

const AnalyzeVideoOutputSchema = z.object({
  analysis: z.string().describe("The text-based analysis of the video content."),
});
export type AnalyzeVideoOutput = z.infer<typeof AnalyzeVideoOutputSchema>;

// This is the function that the UI component will call.
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
    outputSchema: AnalyzeVideoOutputSchema,
  },
  async ({ filePath, mimeType, prompt }) => {
    // The `gs://` protocol requires the pure bucket name, not the full domain.
    // The environment variable NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET contains the full domain like 'project-id.firebasestorage.app'.
    // We need to extract the bucket name, which is 'project-id.appspot.com'.
    const fullBucketDomain = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
    const bucketName = fullBucketDomain.replace('.firebasestorage.app', '.appspot.com');

    if (!bucketName) {
        throw new Error("Firebase Storage bucket name is not configured correctly in environment variables.");
    }
    
    // Construct the correct gs:// URI.
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
