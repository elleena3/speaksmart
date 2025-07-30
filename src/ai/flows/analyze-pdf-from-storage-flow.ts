'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminStorage } from '@/lib/firebase-admin';

const AnalyzePdfFromStorageInputSchema = z.object({
  filePath: z.string().describe("The path to the PDF file in Firebase Storage."),
  prompt: z.string().describe("The prompt describing what to analyze in the PDF."),
});
export type AnalyzePdfFromStorageInput = z.infer<typeof AnalyzePdfFromStorageInputSchema>;

const AnalyzePdfFromStorageOutputSchema = z.object({
  analysis: z.string(),
});
export type AnalyzePdfFromStorageOutput = z.infer<typeof AnalyzePdfFromStorageOutputSchema>;

export async function analyzePdfFromStorage(
  input: AnalyzePdfFromStorageInput,
): Promise<AnalyzePdfFromStorageOutput> {
  return analyzePdfFromStorageFlow(input);
}


const analyzePdfFromStorageFlow = ai.defineFlow(
  {
    name: 'analyzePdfFromStorageFlow',
    inputSchema: AnalyzePdfFromStorageInputSchema,
    outputSchema: AnalyzePdfFromStorageOutputSchema,
  },
  async ({ filePath, prompt }) => {
    try {
      console.log(`[PDF Flow] Starting analysis for file: ${filePath}`);

      // 1. Download the file from Firebase Storage into a buffer
      const bucket = adminStorage.bucket();
      const file = bucket.file(filePath);
      const [buffer] = await file.download();
      
      console.log(`[PDF Flow] File downloaded successfully. Size: ${buffer.length} bytes.`);

      // 2. Create a Part object for the Generative AI model
      const pdfFilePart = {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: 'application/pdf',
        },
      };

      // 3. Call the model with the file part and prompt
      const result = await ai.generate({
        model: 'gemini-2.5-pro',
        prompt: [
            { text: prompt },
            { media: pdfFilePart }
        ],
      });
      
      const analysisText = result.text;
      if (!analysisText) {
        throw new Error("AI model did not return a valid text analysis from the PDF.");
      }

      console.log("[PDF Flow] Analysis successful.");
      return { analysis: analysisText };

    } catch (error: any) {
      console.error("An error occurred during the PDF analysis flow:", error);
      throw new Error(error.message || "An unknown error occurred during PDF analysis.");
    }
  }
);
