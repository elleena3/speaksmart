'use server';

/**
 * @fileOverview Converts text to speech and handles conversational AI responses.
 * Also includes a dedicated function for the Read Aloud tool.
 *
 * - converseWithStudent - A function that takes student audio, gets a conversational response, and returns AI audio.
 * - readAloudText - A function that converts a given text to speech.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';
import {
  ConverseWithStudentInput,
  ConverseWithStudentInputSchema,
  ConverseWithStudentOutput,
  ConverseWithStudentOutputSchema,
  ConversationTurnSchema,
  ReadAloudInputSchema,
  ReadAloudOutputSchema,
  type ReadAloudInput,
  type ReadAloudOutput,
} from '@/lib/types/ai-schemas';
import wav from 'wav';
import { evaluationModels } from '@/lib/types';

// Helper function for retrying API calls on overload
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error.message && (error.message.includes('overloaded') || error.message.includes('503'))) {
        console.warn(`Attempt ${i + 1} failed due to model overload. Retrying in ${delay}ms...`);
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        // Not a retryable error, throw immediately
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

// Reusable function to convert text to speech with fallback logic
async function textToSpeech(text: string, voiceName: string = 'algenib'): Promise<string> {
    const ttsRequestPayload = {
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName as any }, 
                },
            },
        },
        prompt: text,
    };
    
    let ttsResponse;
    try {
        // 1. Try the faster, but lower-quota model first.
        ttsResponse = await withRetry(() => ai.generate({
            model: googleAI.model('gemini-2.5-flash-preview-tts'),
            ...ttsRequestPayload,
        }));
    } catch (error: any) {
        // 2. If it fails with a quota or server error, fallback to the more stable model.
        const errorMessage = (error.message || '').toLowerCase();
        if (errorMessage.includes('429') || errorMessage.includes('500') || errorMessage.includes('503') || errorMessage.includes('overloaded')) {
            console.warn("TTS Flash model failed, falling back to Pro model.", error);
            ttsResponse = await withRetry(() => ai.generate({
                model: googleAI.model('gemini-2.5-pro-preview-tts'), // Fallback model
                ...ttsRequestPayload,
            }));
        } else {
            // 3. For any other error, re-throw it.
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


// ====== Flow for Dialogue Assessments ======
export async function converseWithStudent(
  input: ConverseWithStudentInput
): Promise<ConverseWithStudentOutput> {
  return converseWithStudentFlow(input);
}

const createConversationalPrompt = (modelName: z.infer<typeof evaluationModels[number]>) => {
    return ai.definePrompt({
      name: `conversationalPrompt_${modelName.replace(/[-.]/g, '_')}`,
      model: googleAI.model(modelName),
      input: {
        schema: ConverseWithStudentInputSchema.pick({
          studentRecordingDataUri: true,
          scenario: true,
          scenarioPrompt: true, 
          conversationHistory: true,
          aiVoice: true,
        }).extend({
            history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
        })
      },
      output: { schema: ConverseWithStudentOutputSchema.pick({ aiResponseText: true }) },
      prompt: `You are an AI English conversation partner. Your name is "{{aiVoice}}". You are friendly, patient, and encouraging. Your goal is to have a natural, engaging conversation with a student learning English.

    IMPORTANT RULE: If the student's transcript is "(The user did not say anything)", you MUST respond by asking them to speak again, for example: "Sorry, I didn't catch that. Could you please say that again?" or "I couldn't hear you, can you repeat that?". Do not say "Okay, I see" or try to continue the conversation.

    {{#if scenario}}
    You are in a role-playing scenario. Adapt your persona and responses accordingly.
    Scenario: {{{scenario}}}
    Situation: {{#if scenarioPrompt}} {{{scenarioPrompt}}} {{else}} You are just having a friendly conversation. {{/if}}

    Based on the situation, start the conversation or respond to the student.
    {{else}}
    This is a free-talk session. Have a natural, friendly conversation.
    - Keep your responses relatively short and natural.
    - Ask questions to keep the conversation going.
    - If the student makes a grammatical error, don't correct them directly unless it significantly hinders understanding. The goal is conversation, not a grammar test.
    {{/if}}

    Conversation History (if any):
    {{#each history}}
    {{#if isUser}}Student{{else}}You{{/if}}: {{{text}}}
    {{/each}}

    {{#if studentRecordingDataUri}}
    The student's latest message is an audio recording. Transcribe it and respond.
    {{media url=studentRecordingDataUri}}
    You:
    {{else}}
    You are starting the conversation. Greet the student according to your role and the situation. Keep it short and friendly.
    For example, if you are a shop assistant: "Hi, welcome to our store. Let me know if you need any help finding something."
    For a free talk, you could say: "Hi there! I'm {{aiVoice}}. How are you doing today?"
    You:
    {{/if}}
    `,
    });
}

const converseWithStudentFlow = ai.defineFlow(
  {
    name: 'converseWithStudentFlow',
    inputSchema: ConverseWithStudentInputSchema,
    outputSchema: ConverseWithStudentOutputSchema,
  },
  async ({ studentRecordingDataUri, conversationHistory, scenario, scenarioPrompt, aiVoice, evaluationModel }) => {
    let studentTranscript = "";
    let aiResponseText = "";
    
    // Use the faster model for real-time conversation.
    const model = 'gemini-2.5-flash-lite-preview-06-17';
    const conversationalPrompt = createConversationalPrompt(model);

    if (studentRecordingDataUri) {
      const sttResponse = await withRetry(() => ai.generate({
        model: googleAI.model(model),
        prompt: [
          { text: "Your sole task is to transcribe the provided English audio with absolute precision. Do NOT correct grammar, mispronunciations, or any other errors. Transcribe ONLY the words that are spoken. If a word is unclear, represent it as best you can phonetically. Do not add, remove, or change any words based on context or interpretation. Provide only the raw, transcribed text." },
          { media: { url: studentRecordingDataUri } },
        ],
      }));
      studentTranscript = sttResponse.text;
      if (!studentTranscript?.trim()) {
          console.warn("Transcription result was empty.");
          studentTranscript = "(The user did not say anything)"; 
      }
    }

    const historyForPrompt = conversationHistory.map(turn => ({
      ...turn,
      isUser: turn.role === 'user',
    }));

    const { output } = await withRetry(() => conversationalPrompt({
      history: historyForPrompt,
      studentRecordingDataUri: studentRecordingDataUri, 
      scenario: scenario || 'free-talk',
      scenarioPrompt: scenarioPrompt,
      conversationHistory: conversationHistory,
      aiVoice: aiVoice || 'algenib',
    }));

    aiResponseText = output?.aiResponseText || "Sorry, I'm having a little trouble right now. Could you say that again?";

    const aiResponseAudioDataUri = await textToSpeech(aiResponseText, aiVoice);

    return {
      studentTranscript: studentTranscript === "(The user did not say anything)" ? "" : studentTranscript,
      aiResponseText,
      aiResponseAudioDataUri,
    };
  }
);


// ====== Flow for Read Aloud Tool ======
export async function readAloudText(input: ReadAloudInput): Promise<ReadAloudOutput> {
    return readAloudTextFlow(input);
}

const readAloudTextFlow = ai.defineFlow(
    {
        name: 'readAloudTextFlow',
        inputSchema: ReadAloudInputSchema,
        outputSchema: ReadAloudOutputSchema,
    },
    async ({ text }) => {
        if (!text.trim()) {
            throw new Error("Cannot read empty text.");
        }
        // Using a standard, clear male voice for reading.
        const audioDataUri = await textToSpeech(text, 'puck');
        return { audioDataUri };
    }
);
