'use server';

/**
 * @fileOverview Converts text to speech and handles conversational AI responses.
 *
 * - converseWithStudent - A function that takes student audio, gets a conversational response, and returns AI audio.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import {
  ConverseWithStudentInput,
  ConverseWithStudentInputSchema,
  ConverseWithStudentOutput,
  ConverseWithStudentOutputSchema,
  ConversationTurnSchema,
} from '@/lib/types/ai-schemas';
import wav from 'wav';
import { z } from 'zod';

export async function converseWithStudent(
  input: ConverseWithStudentInput
): Promise<ConverseWithStudentOutput> {
  return converseWithStudentFlow(input);
}


// 1. Define the prompt for generating the conversational text response
const conversationalPrompt = ai.definePrompt({
  name: 'conversationalPrompt',
  input: {
    schema: z.object({
      history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
      studentTranscript: z.string().optional(), // Make student transcript optional
    }),
  },
  output: { schema: z.string() },
  prompt: `You are an AI English conversation partner. Your name is "Alex". You are friendly, patient, and encouraging. Your goal is to have a natural, engaging conversation with a student learning English.
- Keep your responses relatively short and natural.
- Ask questions to keep the conversation going.
- If the student makes a grammatical error, don't correct them directly unless it significantly hinders understanding. The goal is conversation, not a grammar test.
- The student's latest message is a transcript from their speech. Respond to it.

{{#if studentTranscript}}
Conversation History:
{{#each history}}
{{#if isUser}}Student{{else}}You{{/if}}: {{{text}}}
{{/each}}
Student: {{{studentTranscript}}}
You: 
{{else}}
You are starting the conversation. Greet the student and ask them how they are or what they'd like to talk about. For example: "Hi there! I'm Alex. How are you doing today?" or "Hello! I'm ready to chat when you are. What's on your mind?".
You:
{{/if}}`,
});

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

// 2. Define the main flow that orchestrates the entire process
const converseWithStudentFlow = ai.defineFlow(
  {
    name: 'converseWithStudentFlow',
    inputSchema: ConverseWithStudentInputSchema,
    outputSchema: ConverseWithStudentOutputSchema,
  },
  async ({ studentRecordingDataUri, conversationHistory }) => {
    let studentTranscript = '';

    // Step 1: Transcribe student's audio to text (STT), if provided
    if (studentRecordingDataUri) {
        const sttResponse = await ai.generate({
          model: googleAI.model('gemini-2.0-flash'), // Using a powerful model for transcription
          prompt: [
            {
              text: 'Transcribe the following audio. The user is a non-native English speaker. Just provide the transcript, nothing else.',
            },
            { media: { url: studentRecordingDataUri } },
          ],
        });
        studentTranscript = sttResponse.text;
        if (!studentTranscript) {
            throw new Error("Could not transcribe student audio.");
        }
    }


    // Step 2: Generate AI's text response based on transcript and history
    // Add the `isUser` flag to the history for the Handlebars template
    const historyForPrompt = conversationHistory.map(turn => ({
      ...turn,
      isUser: turn.role === 'user',
    }));

    const textResponse = await conversationalPrompt({
      history: historyForPrompt,
      studentTranscript: studentTranscript || undefined,
    });
    const aiResponseText = textResponse;

    // Step 3: Convert AI's text response to speech (TTS)
    const ttsResponse = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-preview-tts'),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Alloy' }, // A friendly, natural voice
          },
        },
      },
      prompt: aiResponseText,
    });

    const audioMedia = ttsResponse.media;
    if (!audioMedia) {
      throw new Error('TTS did not return any audio media.');
    }

    // The TTS model returns raw PCM data, which needs a WAV header to be playable in browsers.
    const pcmBuffer = Buffer.from(
      audioMedia.url.substring(audioMedia.url.indexOf(',') + 1),
      'base64'
    );
    const wavBase64 = await toWav(pcmBuffer);

    // Step 4: Return all the generated data
    return {
      studentTranscript,
      aiResponseText,
      aiResponseAudioDataUri: 'data:audio/wav;base64,' + wavBase64,
    };
  }
);
