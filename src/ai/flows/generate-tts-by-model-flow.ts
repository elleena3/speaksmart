
'use server';

/**
 * @fileOverview A flow to generate speech from text using a specific TTS model.
 * This tool is for testing the operational status of different TTS models.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import wav from 'wav';

const ttsModels = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"] as const;

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
    const ttsResponse = await ai.generate({
        model: googleAI.model(modelName),
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
