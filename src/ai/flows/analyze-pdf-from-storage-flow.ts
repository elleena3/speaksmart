'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminStorage } from '@/lib/firebase-admin';
import { googleAI } from '@genkit-ai/googleai';

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

// Helper function for retrying API calls on overload or transient server errors
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error.message || '';
      // Check for common transient error codes
      if (errorMessage.includes('503') || errorMessage.includes('500') || errorMessage.includes('overloaded')) {
        console.warn(`[withRetry] Attempt ${i + 1} failed due to server error. Retrying in ${delay}ms...`);
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1))); // Increase delay for subsequent retries
        }
      } else {
        // Not a retryable error, throw immediately
        throw error;
      }
    }
  }
  console.error("All retry attempts failed.", lastError);
  throw new Error(`AI 모델이 일시적인 과부하 상태입니다. 모든 재시도에 실패했습니다: ${lastError.message}`);
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

      const pdfDataUri = `data:application/pdf;base64,${buffer.toString("base64")}`;

      // 2. Call the model with the Data URI, now wrapped in our retry logic.
      const result = await withRetry(() => 
        ai.generate({
          model: googleAI.model('gemini-2.5-pro'),
          prompt: [
              { text: prompt },
              { media: { url: pdfDataUri } }
          ],
        })
      );
      
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
