
'use server';
import { requireTeacher } from '@/lib/auth-guard';

/**
 * @fileOverview A Genkit flow to generate an image from a text prompt.
 *
 * - generateImage - A function that takes a text prompt and returns an image data URI.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import { imageGenerationModels } from '@/lib/types';
import { describeAiError } from '@/lib/ai-error-message';

const GenerateImageInputSchema = z.object({
  prompt: z.string().describe('A text prompt describing the image to generate.'),
  imageModel: z.enum(imageGenerationModels).optional().default('googleai/gemini-3.1-flash-image'),
});
export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;

const GenerateImageOutputSchema = z.object({
  imageDataUri: z.string().describe('The generated image as a data URI.'),
});
export type GenerateImageOutput = z.infer<typeof GenerateImageOutputSchema>;

/**
 * 서버 액션에서 예외를 던지면 Next.js 가 프로덕션에서 메시지를 지우고 digest 만 남깁니다.
 * 화면에서 원인을 알 수 있도록 실패를 값으로 돌려줍니다.
 */
export type GenerateImageResult =
  | { ok: true; data: GenerateImageOutput }
  | { ok: false; error: string };

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  // 서버 액션은 인증 없이 호출될 수 있어 호출자를 먼저 확인합니다.
  await requireTeacher();

  try {
    const data = await generateImageFlow(input);
    return { ok: true, data };
  } catch (e) {
    const info = describeAiError(e, input.imageModel, '이미지 생성');
    console.error('generateImage 실패:', info.kind, info.detail);
    return { ok: false, error: info.message };
  }
}

const generateImageFlow = ai.defineFlow(
  {
    name: 'generateImageFlow',
    inputSchema: GenerateImageInputSchema,
    outputSchema: GenerateImageOutputSchema,
  },
  async ({ prompt, imageModel }) => {

    const modelToUse = imageModel || 'googleai/gemini-3.1-flash-image';

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
        // gpt-image 계열은 response_format 을 받지 않습니다.
        // 넣으면 400 Unknown parameter 로 거부되고, 빼면 b64_json 이 기본으로 옵니다.
        body: JSON.stringify({
          model: rawModelName,
          prompt: finalPrompt,
          n: 1,
          size: "1024x1024"
        })
      });

      if (!res.ok) {
        // 원문을 남겨야 어떤 파라미터가 거부됐는지 알 수 있습니다.
        const detail = await res.text().catch(() => '');
        console.error("OpenAI Image Error", res.status, detail);
        throw new Error(`OpenAI image generation failed (${res.status}): ${detail}`);
      }

      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('OpenAI image generation returned empty data');

      return { imageDataUri: `data:image/png;base64,${b64}` };
    }

    // Google AI Path
    // 'googleai/' 접두사를 떼면 레지스트리에서 찾지 못해 NOT_FOUND 가 납니다. 그대로 넘깁니다.
    const { media } = await ai.generate({
      model: modelToUse as any,
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
