
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import * as https from 'https';

const AnalyzeVideoInputSchema = z.object({
  gcsUri: z.string().describe("Publicly accessible HTTPS URL to the video file."),
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
      throw new Error(error.message || "An unknown error occurred during video analysis.");
    }
  }
);
