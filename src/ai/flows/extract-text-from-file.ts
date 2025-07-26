
'use server';

/**
 * @fileOverview A flow to extract text from an uploaded file (PDF, image, or TXT).
 *
 * - extractTextFromFile - A function that takes a file data URI and returns its text content.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const ExtractTextFromFileInputSchema = z.object({
  fileDataUri: z.string().describe(
    "A file (image, PDF, or TXT) as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
});
export type ExtractTextFromFileInput = z.infer<typeof ExtractTextFromFileInputSchema>;

const ExtractTextFromFileOutputSchema = z.object({
  extractedText: z.string().describe('The text content extracted from the provided file.'),
});
export type ExtractTextFromFileOutput = z.infer<typeof ExtractTextFromFileOutputSchema>;

export async function extractTextFromFile(input: ExtractTextFromFileInput): Promise<ExtractTextFromFileOutput> {
  // Handle plain text files on the server to avoid client-side complexity
  if (input.fileDataUri.startsWith('data:text/plain')) {
      const base64Content = input.fileDataUri.substring(input.fileDataUri.indexOf(',') + 1);
      const plainText = Buffer.from(base64Content, 'base64').toString('utf-8');
      return { extractedText: plainText };
  }
  
  // Use AI for images and PDFs
  return extractTextWithAIFlow(input);
}


const extractTextWithAIPrompt = ai.definePrompt({
    name: 'extractTextWithAIPrompt',
    model: googleAI.model('gemini-2.5-flash'),
    input: { schema: ExtractTextFromFileInputSchema },
    output: { schema: ExtractTextFromFileOutputSchema },
    prompt: `You are an Optical Character Recognition (OCR) specialist. Your task is to extract all the text content from the provided file (image or PDF).

- File for OCR: 
{{media url=fileDataUri}}

Please perform the following steps:
1.  Analyze the provided file.
2.  Extract all textual content you can identify. Preserve paragraph breaks and original formatting as much as possible.
3.  Return the extracted text in the 'extractedText' field of the JSON output. If no text is found, return an empty string.
`,
});

const extractTextWithAIFlow = ai.defineFlow(
  {
    name: 'extractTextWithAIFlow',
    inputSchema: ExtractTextFromFileInputSchema,
    outputSchema: ExtractTextFromFileOutputSchema,
  },
  async (input) => {
    const { output } = await extractTextWithAIPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return any extracted text.");
    }
    return output;
  }
);
