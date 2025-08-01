
'use server';

/**
 * @fileOverview A flow to generate speech from text using a specific voice model.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import wav from 'wav';
import { allVoices, type AiVoice } from '@/lib/types';

const GenerateTtsByModelInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voice: z.enum(allVoices).describe('The voice model to use for generation.'),
});
export type GenerateTtsByModelInput = z.infer<typeof GenerateTtsByModelInputSchema>;

const GenerateTtsByModelOutputSchema = z.object({
  audioDataUri: z.string().describe("The generated audio as a playable data URI."),
});
export type GenerateTtsByModelOutput = z.infer<typeof GenerateTtsByModelOutputSchema>;


// Helper function for retrying API calls on overload
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error.message && (error.message.includes('overloaded') || error.message.includes('503') || error.message.includes('429'))) {
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

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

async function textToSpeech(text: string, voiceName: AiVoice): Promise<string> {
    const ttsRequestPayload = {
        config: {
            responseModalities: ['AUDIO'] as const,
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName },
                },
            },
        },
        prompt: text,
    };
    
    let ttsResponse;
    try {
        ttsResponse = await withRetry(() => ai.generate({
            model: googleAI.model('gemini-2.5-flash-preview-tts'),
            ...ttsRequestPayload,
        }));
    } catch (error: any) {
        const errorMessage = (error.message || '').toLowerCase();
        if (errorMessage.includes('429') || errorMessage.includes('500') || errorMessage.includes('503') || errorMessage.includes('overloaded')) {
            ttsResponse = await withRetry(() => ai.generate({
                model: googleAI.model('gemini-2.5-pro-preview-tts'),
                ...ttsRequestPayload,
            }));
        } else {
            throw error;
        }
    }

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
  async ({ text, voice }) => {
    if (!text.trim()) {
        throw new Error("Cannot convert empty text to speech.");
    }
    const audioDataUri = await textToSpeech(text, voice);
    return { audioDataUri };
  }
);
