
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
import { evaluationModels, scenarios, allVoices } from '@/lib/types';
import { summarizeConversationHistoryFlow } from './summarize-conversation-history-flow';

const CONVERSATION_MEMORY_LIMIT = 20;

// Helper function for retrying API calls on overload
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error.message && (error.message.includes('overloaded') || error.message.includes('503') || error.message.includes('429'))) {
        console.warn(`[withRetry] Attempt ${i + 1} failed due to server error. Retrying in ${delay}ms...`);
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

// Reusable function to convert text to speech with fallback
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
        schema: z.object({
            studentTranscript: z.string().optional(),
            historySummary: z.string().optional(),
            history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
            scenario: z.enum(scenarios).optional(),
            scenarioPrompt: z.string().optional(),
            aiVoice: z.enum(allVoices).optional(),
            conversationGoal: z.string().optional(),
        })
      },
      output: { schema: ConverseWithStudentOutputSchema.pick({ aiResponseText: true }) },
      prompt: `You are an AI English conversation partner. Your name is "{{aiVoice}}". Your persona is friendly, patient, and encouraging.

Your response style MUST follow these specific rules:
- Keep responses under 3 sentences.
- Ask follow-up questions 50% of the time to keep the conversation flowing.
- Do not repeat the student's sentence unless you are asking for clarification.
- Do not correct grammar directly unless it significantly hinders understanding. The goal is conversation, not a grammar test.

{{#if conversationGoal}}
Today's conversation goal is: "{{conversationGoal}}"
Please try to guide the conversation towards this topic.
{{/if}}

IMPORTANT RULE: If the student's transcript is "(The user did not say anything)", you MUST respond by asking them to speak again, for example: "Sorry, I didn't catch that. Could you please say that again?" or "I couldn't hear you, can you repeat that?".

{{#if historySummary}}
This is a summary of the conversation so far. You must use this to understand the long-term context:
{{{historySummary}}}
---
{{/if}}

Here is the most recent part of the conversation. You must continue from here:
{{#each history}}
{{#if isUser}}Student{{else}}You{{/if}}: {{{text}}}
{{/each}}

{{#if studentTranscript}}
The student's latest message is a transcript from their speech. Respond to it.
Student: {{{studentTranscript}}}
You:
{{else}}
You are starting the conversation. Greet the student according to the situation. Keep it short and friendly.
{{#if scenario}}
You are in a role-playing scenario: {{{scenario}}}.
Situation: {{#if scenarioPrompt}} {{{scenarioPrompt}}} {{else}} You are just having a friendly conversation. {{/if}}
{{else}}
This is a free-talk session.
Example: "Hi there! I'm {{aiVoice}}. How are you doing today?"
{{/if}}
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
    
    let historyForPrompt = conversationHistory.map(turn => ({
      ...turn,
      isUser: turn.role === 'user',
    }));
    let historySummary: string | undefined = undefined;

    if (historyForPrompt.length >= CONVERSATION_MEMORY_LIMIT) {
        const splitIndex = Math.max(0, historyForPrompt.length - CONVERSATION_MEMORY_LIMIT);
        const oldHistory = historyForPrompt.slice(0, splitIndex);
        const recentHistory = historyForPrompt.slice(splitIndex);
        
        if (oldHistory.length > 0) {
            const summaryResult = await summarizeConversationHistoryFlow({ conversationToSummarize: oldHistory });
            historySummary = summaryResult.summary;
        }
        historyForPrompt = recentHistory;
    }

    let finalTranscriptForPrompt = studentTranscript || undefined;
    const lastTurn = historyForPrompt[historyForPrompt.length - 1];
    if (lastTurn && lastTurn.isUser && lastTurn.text === studentTranscript) {
        finalTranscriptForPrompt = undefined;
    }


    const { output } = await withRetry(() => conversationalPrompt({
      history: historyForPrompt,
      historySummary,
      studentTranscript: finalTranscriptForPrompt, 
      scenario: scenario || 'free-talk',
      scenarioPrompt: scenarioPrompt,
      aiVoice: aiVoice || 'algenib',
      conversationGoal: "Practice general conversational skills.", // Default goal
    }));

    aiResponseText = output?.aiResponseText || "Sorry, I'm having a little trouble right now. Could you say that again?";

    const aiResponseAudioDataUri = await textToSpeech(aiResponseText, aiVoice || 'algenib');

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
        const audioDataUri = await textToSpeech(text, 'puck');
        return { audioDataUri };
    }
);
