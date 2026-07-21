
'use server';

/**
 * @fileOverview A flow to generate speech from text using a specific TTS model.
 * This tool is for testing the operational status of different TTS models.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import wav from 'wav';

const ttsModels = ["googleai/gemini-3.1-flash-tts-preview", "openai/gpt-4o-mini-tts"] as const;

const GenerateTtsByModelInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  model: z.enum(ttsModels).describe('The TTS model to use for generation.'),
});
export type GenerateTtsByModelInput = z.infer<typeof GenerateTtsByModelInputSchema>;

const GenerateTtsByModelOutputSchema = z.object({
  audioDataUri: z.string().describe("The generated audio as a playable data URI."),
});
export type GenerateTtsByModelOutput = z.infer<typeof GenerateTtsByModelOutputSchema>;


// Helper function to convert PCM audio buffer to WAV format
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

// Reusable function to convert text to speech
async function textToSpeech(text: string, modelName: (typeof ttsModels)[number]): Promise<string> {
  if (modelName === 'openai/gpt-4o-mini-tts') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI API Key is missing in environment variables.");

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        input: text,
        voice: "alloy"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI TTS Error: ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:audio/mp3;base64,${base64}`;
  }

  const ttsResponse = await ai.generate({
    model: modelName,
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'algenib' }, // Fixed voice for consistency
        },
      },
    },
    prompt: text,
  });

  const audioMedia = ttsResponse.media;
  if (!audioMedia) {
    throw new Error('TTS did not return any audio media.');
  }

  const pcmBuffer = Buffer.from(
    audioMedia.url.substring(audioMedia.url.indexOf(',') + 1),
    'base64'
  );

  return 'data:audio/wav;base64,' + await toWav(pcmBuffer);
}


export const generateTtsByModelFlow = ai.defineFlow(
  {
    name: 'generateTtsByModelFlow',
    inputSchema: GenerateTtsByModelInputSchema,
    outputSchema: GenerateTtsByModelOutputSchema,
  },
  async ({ text, model }) => {
    if (!text.trim()) {
      throw new Error("Cannot convert empty text to speech.");
    }
    const audioDataUri = await textToSpeech(text, model);
    return { audioDataUri };
  }
);
