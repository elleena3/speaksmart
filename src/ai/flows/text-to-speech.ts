'use server';

/**
 * @fileOverview Converts text to speech and handles conversational AI responses.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  ConverseWithStudentInputSchema,
  ConverseWithStudentOutputSchema,
  ConversationTurnSchema,
  ReadAloudInputSchema,
  ReadAloudOutputSchema,
} from '@/lib/types/ai-schemas';
import wav from 'wav';
import { summarizeConversationHistoryFlow } from './summarize-conversation-history-flow';

const CONVERSATION_HISTORY_LIMIT = 20;

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error.message && (error.message.includes('overloaded') || error.message.includes('503') || error.message.includes('429'))) {
        console.warn(`[withRetry] Attempt ${i + 1} failed. Retrying...`);
        if (i < retries) await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({ channels, sampleRate: rate, bitDepth: sampleWidth * 8 });
    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', d => bufs.push(d));
    writer.on('end', () => resolve(Buffer.concat(bufs).toString('base64')));
    writer.write(pcmData);
    writer.end();
  });
}

async function textToSpeech(text: string, voiceName: string = 'algenib'): Promise<string> {
    const ttsResponse = await withRetry(() => ai.generate({
        model: 'gemini-2.5-flash-preview-tts',
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName as any } } },
        },
        prompt: text,
    }));

    if (!ttsResponse.media) throw new Error('TTS 응답에 오디오가 없습니다.');
    const pcmBuffer = Buffer.from(ttsResponse.media.url.substring(ttsResponse.media.url.indexOf(',') + 1), 'base64');
    return 'data:audio/wav;base64,' + await toWav(pcmBuffer);
}

// --- Top-level Prompts ---

const baseConversationalPrompt = ai.definePrompt({
    name: 'baseConversationalPrompt',
    input: {
        schema: z.object({
            studentTranscript: z.string().optional(),
            historySummary: z.string().optional(),
            history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
            scenario: z.string().optional(),
            scenarioPrompt: z.string().optional(),
            aiVoice: z.string().optional(),
        })
    },
    prompt: `You are an AI English conversation partner "{{aiVoice}}". 
Rules:
- Short responses (under 3 sentences).
- Ask questions.
- No grammar corrections unless critical.

{{#if historySummary}}Summary: {{{historySummary}}}{{/if}}

Recent History:
{{#each history}}{{#if isUser}}Student{{else}}You{{/if}}: {{{text}}}
{{/each}}

{{#if studentTranscript}}Student: {{{studentTranscript}}}
You:{{else}}Start the conversation:
You:{{/if}}`,
});

// --- Exported Functions ---

export async function converseWithStudent(input: any): Promise<any> {
    const { studentRecordingDataUri, conversationHistory, scenario, scenarioPrompt, aiVoice, evaluationModel } = input;
    const model = evaluationModel || 'gemini-2.5-flash-preview-09-2025';
    let studentTranscript = "";

    if (studentRecordingDataUri) {
        const sttResponse = await withRetry(() => ai.generate({
            model: 'gemini-2.5-flash-preview-09-2025',
            prompt: [
                { text: "Transcribe ONLY the words spoken in this audio with absolute precision." },
                { media: { url: studentRecordingDataUri } }
            ]
        }));
        studentTranscript = sttResponse.text;
    }

    let historyForPrompt = conversationHistory.map((turn: any) => ({ ...turn, isUser: turn.role === 'user' }));
    let historySummary: string | undefined;

    if (historyForPrompt.length >= CONVERSATION_HISTORY_LIMIT) {
        const summaryResult = await summarizeConversationHistoryFlow({ conversationToSummarize: historyForPrompt.slice(0, -10) });
        historySummary = summaryResult.summary;
        historyForPrompt = historyForPrompt.slice(-10);
    }

    const { text } = await withRetry(() => baseConversationalPrompt({
        history: historyForPrompt,
        historySummary,
        studentTranscript: studentTranscript || undefined,
        scenario,
        scenarioPrompt,
        aiVoice: aiVoice || 'algenib',
    }, { model }));

    const aiResponseAudioDataUri = await textToSpeech(text || "Sorry, I missed that.", aiVoice);

    return {
        studentTranscript: studentTranscript === "(The user did not say anything)" ? "" : studentTranscript,
        aiResponseText: text,
        aiResponseAudioDataUri,
    };
}

export async function readAloudText(input: any): Promise<any> {
    const audioDataUri = await textToSpeech(input.text, 'puck');
    return { audioDataUri };
}