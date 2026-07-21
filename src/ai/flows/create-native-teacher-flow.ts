
'use server';

/**
 * @fileOverview Converts audio to speech and handles conversational AI responses for the teacher's tool.
 * This version processes audio on the server for better performance.
 *
 * - converseWithNativeTeacher - A function that takes user audio, gets a conversational response, and returns AI audio.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import {
  ConversationTurnSchema,
} from '@/lib/types/ai-schemas';
import wav from 'wav';
import { summarizeConversationHistoryFlow } from './summarize-conversation-history-flow';

const CONVERSATION_MEMORY_LIMIT = 20;


const ConverseWithNativeTeacherInputSchema = z.object({
  studentRecordingDataUri: z
    .string()
    .describe(
      "The user's voice recording as a data URI."
    ).nullable(),
  conversationHistory: z
    .array(ConversationTurnSchema)
    .describe('The history of the conversation so far.'),
  conversationGoal: z.string().optional().describe('The goal for this specific conversation session.'),
});
type ConverseWithNativeTeacherInput = z.infer<typeof ConverseWithNativeTeacherInputSchema>;

const ConverseWithNativeTeacherOutputSchema = z.object({
  aiResponseText: z.string().describe('The text of the AI conversational partner.'),
  aiResponseAudioDataUri: z.string().describe("The AI's response as a playable audio data URI."),
  studentTranscript: z.string().describe("The transcript of the user's speech."),
});
type ConverseWithNativeTeacherOutput = z.infer<typeof ConverseWithNativeTeacherOutputSchema>;


export async function converseWithNativeTeacher(
  input: ConverseWithNativeTeacherInput
): Promise<ConverseWithNativeTeacherOutput> {
  return converseWithNativeTeacherFlow(input);
}

const conversationalPrompt = ai.definePrompt({
  name: 'nativeTeacherConversationalPrompt',
  model: googleAI.model('gemini-3.1-flash-lite'),
  input: {
    schema: z.object({
      studentTranscript: z.string().optional(),
      history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
      historySummary: z.string().optional(),
      conversationGoal: z.string().optional(),
    })
  },
  output: { schema: z.object({ aiResponseText: z.string() }) },
  prompt: `You are an AI English conversation partner for a teacher. Your name is "Dr. Alex". Your persona is friendly, patient, and incredibly knowledgeable.

Your primary goals are:
1.  Have a natural, engaging conversation in English.
2.  Answer any question the user asks, demonstrating your vast knowledge.
3.  Assess the user's English proficiency level based on their speech.
4.  Adapt your language to the user's level.

Your response style MUST follow these specific rules:
- Keep your responses under 3 sentences.
- Ask a follow-up question about 50% of the time to keep the conversation flowing.
- Do not repeat the user's sentence unless you are asking for clarification.

{{#if conversationGoal}}
Today's conversation goal is: "{{conversationGoal}}"
Please try to guide the conversation towards this topic.
{{/if}}

IMPORTANT RULE: If the user's transcript is empty or indicates no speech, you MUST ask them to speak again, for example: "Sorry, I didn't catch that. Could you please say that again?" or "I couldn't hear you, can you repeat that?".

{{#if historySummary}}
This is a summary of the conversation so far. You must use this to understand the long-term context:
{{{historySummary}}}
---
{{/if}}

Here is the most recent part of the conversation. You must continue from here:
{{#each history}}
{{#if isUser}}User{{else}}You{{/if}}: {{{text}}}
{{/each}}

{{#if studentTranscript}}
The user's latest message is a transcript from their speech. Respond to it naturally, keeping your persona and all rules in mind.
User: {{{studentTranscript}}}
You:
{{else}}
You are starting the conversation. Greet the user and introduce yourself.
Example: "Hello! I'm Dr. Alex. I'm a native English speaker and I'd be happy to talk about anything you'd like. What's on your mind today?"
You:
{{/if}}
`,
});


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

async function textToSpeech(text: string): Promise<string> {
    const ttsRequestPayload = {
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Algenib' },
                },
            },
        },
        prompt: text,
    };
    
    let ttsResponse;
    try {
        ttsResponse = await ai.generate({
            model: googleAI.model('gemini-3.1-flash-tts-preview'),
            ...ttsRequestPayload,
        });
    } catch (error: any) {
        const errorMessage = (error.message || '').toLowerCase();
        if (errorMessage.includes('429') || errorMessage.includes('500') || errorMessage.includes('503') || errorMessage.includes('overloaded')) {
            console.warn("TTS Flash model failed, falling back to Pro model.", error);
            ttsResponse = await ai.generate({
                model: googleAI.model('gemini-3.1-flash-tts-preview'),
                ...ttsRequestPayload,
            });
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

const converseWithNativeTeacherFlow = ai.defineFlow(
  {
    name: 'converseWithNativeTeacherFlow',
    inputSchema: ConverseWithNativeTeacherInputSchema,
    outputSchema: ConverseWithNativeTeacherOutputSchema,
  },
  async ({ studentRecordingDataUri, conversationHistory, conversationGoal }) => {
    let studentTranscript = "";
    let aiResponseText = "";

    if (studentRecordingDataUri) {
      const sttResponse = await ai.generate({
        model: googleAI.model('gemini-3.5-flash'),
        prompt: [
          { text: 'Transcribe this English audio.' },
          { media: { url: studentRecordingDataUri } },
        ],
      });
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

    const { output } = await conversationalPrompt({
      history: historyForPrompt,
      studentTranscript: finalTranscriptForPrompt, 
      historySummary,
      conversationGoal,
    });

    aiResponseText = output?.aiResponseText || "";

    if (!aiResponseText) {
        console.error("AI did not generate a text response. Received:", output);
        aiResponseText = "Sorry, I'm having a little trouble right now. Could you say that again?";
    }

    const aiResponseAudioDataUri = await textToSpeech(aiResponseText);

    return {
      studentTranscript: studentTranscript === "(The user did not say anything)" ? "" : studentTranscript,
      aiResponseText,
      aiResponseAudioDataUri,
    };
  }
);
