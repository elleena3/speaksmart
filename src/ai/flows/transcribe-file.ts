
'use server';

/**
 * @fileOverview A simple flow to transcribe an audio file.
 *
 * - transcribeFile - A function that takes an audio data URI and returns the transcript.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const TranscribeFileInputSchema = z.object({
    audioDataUri: z.string().describe(
      "An audio file as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:audio/webm;codecs=opus;base64,<encoded_data>'."
    )
});

export async function transcribeFile(audioDataUri: string): Promise<string> {
  const result = await transcribeFileFlow({ audioDataUri });
  return result;
}

const transcriptionPrompt = ai.definePrompt({
  name: 'transcribeFilePrompt',
  // Use a more powerful model specifically for this public-facing tool.
  model: googleAI.model('gemini-2.0-flash'),
  input: { schema: TranscribeFileInputSchema },
  prompt: `Transcribe this English audio. If the audio is silent or contains no discernible speech, return an empty string.
Audio: {{media url=audioDataUri contentType='audio/webm;codecs=opus'}}
`,
});

const transcribeFileFlow = ai.defineFlow(
  {
    name: 'transcribeFileFlow',
    inputSchema: TranscribeFileInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const transcriptionResult = await transcriptionPrompt(input);
    return transcriptionResult.text;
  }
);
