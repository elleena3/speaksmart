
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

    let finalPrompt = `A high-quality, clear, simple illustration suitable for an English speaking test. The image should be in a square aspect ratio. Prompt: ${prompt}`;

    if (modelToUse.startsWith('openai/')) {
      const rawModelName = modelToUse.replace('openai/', '');
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI API KEY missing from server configuration.");

      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: rawModelName,
          prompt: finalPrompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("OpenAI Image Error", err);
        throw new Error(`OpenAI image generation failed: ${res.statusText}`);
      }

      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('OpenAI image generation returned empty data');

      return { imageDataUri: `data:image/png;base64,${b64}` };
    }

    // Google AI Path
    const rawGoogleModel = modelToUse.replace('googleai/', '');
    const { media } = await ai.generate({
      model: rawGoogleModel as any,
      prompt: finalPrompt,
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
