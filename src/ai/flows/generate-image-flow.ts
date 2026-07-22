
'use server';

/**
 * @fileOverview A Genkit flow to generate an image from a text prompt.
 *
 * - generateImage - A function that takes a text prompt and returns an image data URI.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import { imageGenerationModels } from '@/lib/types';

const GenerateImageInputSchema = z.object({
  prompt: z.string().describe('A text prompt describing the image to generate.'),
  imageModel: z.enum(imageGenerationModels).optional().default('googleai/gemini-3.1-flash-lite-image'),
});
export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;

const GenerateImageOutputSchema = z.object({
  imageDataUri: z.string().describe('The generated image as a data URI.'),
});
export type GenerateImageOutput = z.infer<typeof GenerateImageOutputSchema>;

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  return generateImageFlow(input);
}

const generateImageFlow = ai.defineFlow(
  {
    name: 'generateImageFlow',
    inputSchema: GenerateImageInputSchema,
    outputSchema: GenerateImageOutputSchema,
  },
  async ({ prompt, imageModel }) => {

    const modelToUse = imageModel || 'googleai/gemini-3.1-flash-lite-image';

    const { media } = await ai.generate({
      model: googleAI.model(modelToUse as any),
      prompt: `A high-quality, clear, simple illustration suitable for an English speaking test. The image should be in a square aspect ratio. Prompt: ${prompt}`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media?.url) {
      throw new Error('Image generation failed to return an image.');
    }

    return { imageDataUri: media.url };
  }
);
