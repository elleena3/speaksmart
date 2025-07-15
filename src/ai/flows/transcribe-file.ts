
'use server';

/**
 * @fileOverview A simple flow to transcribe an audio file using multiple models for comparison.
 *
 * - transcribeFile - A function that takes an audio data URI and returns transcripts from multiple models.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const TranscribeFileInputSchema = z.object({
  audioDataUri: z.string().describe(
    "An audio file as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:audio/webm;codecs=opus;base64,<encoded_data>'."
  )
});

const TranscriptionResultSchema = z.object({
  transcript: z.string().describe('The transcribed text from the audio.'),
  model: z.string().describe('The name of the model that generated this transcript.'),
});

export type TranscriptionResult = z.infer<typeof TranscriptionResultSchema>;

export async function transcribeFile(audioDataUri: string): Promise<TranscriptionResult[]> {
  const result = await transcribeFileFlow({ audioDataUri });
  return result;
}

const modelsToCompare = [
    'gemini-2.5-flash-lite-preview-06-17',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
];

const createTranscriptionPrompt = (modelName: string) => {
    return ai.definePrompt({
        name: `transcriptionPrompt_${modelName.replace(/[-.]/g, '_')}`,
        model: googleAI.model(modelName as any),
        input: { schema: TranscribeFileInputSchema },
        prompt: `Transcribe this English audio. If the audio is silent or contains no discernible speech, return an empty string.
Audio: {{media url=audioDataUri contentType='audio/webm;codecs=opus'}}
`,
    });
}


const transcribeFileFlow = ai.defineFlow(
  {
    name: 'transcribeFileFlow',
    inputSchema: TranscribeFileInputSchema,
    outputSchema: z.array(TranscriptionResultSchema),
  },
  async (input) => {
    const transcriptionPromises = modelsToCompare.map(async (modelName) => {
        try {
            const prompt = createTranscriptionPrompt(modelName);
            const { text } = await prompt(input);
            return { transcript: text || '(변환된 텍스트 없음)', model: modelName };
        } catch (error: any) {
            console.error(`Error transcribing with model ${modelName}:`, error);
            return {
                model: modelName,
                transcript: `[오류] 모델 변환에 실패했습니다: ${error.message}`
            }
        }
    });

    const results = await Promise.all(transcriptionPromises);
    return results;
  }
);
