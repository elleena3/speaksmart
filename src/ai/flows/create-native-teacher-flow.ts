
'use server';

/**
 * @fileOverview Converts text to speech and handles conversational AI responses for the teacher's tool.
 *
 * - converseWithNativeTeacher - A function that takes user audio, gets a conversational response, and returns AI audio.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import {
  ConversationTurnSchema,
} from '@/lib/types/ai-schemas';
import wav from 'wav';


const ConverseWithNativeTeacherInputSchema = z.object({
  studentRecordingDataUri: z
    .string()
    .describe(
      "The user's voice recording as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ).nullable(),
  conversationHistory: z
    .array(ConversationTurnSchema)
    .describe('The history of the conversation so far.'),
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

// 1. Define the prompt for generating the conversational text response
const conversationalPrompt = ai.definePrompt({
  name: 'nativeTeacherConversationalPrompt',
  model: googleAI.model('gemini-2.5-flash-lite-preview-06-17'),
  input: {
    schema: z.object({
      studentTranscript: z.string().optional(),
      history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
    })
  },
  output: { schema: z.object({ aiResponseText: z.string() }) },
  prompt: `You are an AI English conversation partner for a teacher. Your name is "Dr. Alex". You are a native English speaker and an omniscient expert on all topics. Your persona is friendly, patient, and incredibly knowledgeable.

Your primary goals are:
1.  Have a natural, engaging conversation in English.
2.  Answer any question the user asks, demonstrating your vast knowledge.
3.  Assess the user's English proficiency level based on their speech.
4.  Adapt your language to the user's level. If their English is basic, use simpler words and sentence structures. If they are advanced, use more sophisticated language.

IMPORTANT RULE: If the user's transcript is empty or indicates no speech, you MUST ask them to speak again, for example: "Sorry, I didn't catch that. Could you please say that again?" or "I couldn't hear you, can you repeat that?". Do not try to continue the conversation.

Conversation History (if any):
{{#each history}}
{{#if isUser}}User{{else}}You{{/if}}: {{{text}}}
{{/each}}

{{#if studentTranscript}}
The user's latest message is a transcript from their speech. Respond to it naturally, keeping your persona in mind.
User: {{{studentTranscript}}}
You:
{{else}}
You are starting the conversation. Greet the user and introduce yourself.
Example: "Hello! I'm Dr. Alex. I'm a native English speaker and I'd be happy to talk about anything you'd like. What's on your mind today?"
You:
{{/if}}
`,
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

// Function to convert text to speech
async function textToSpeech(text: string): Promise<string> {
    const ttsResponse = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Alpheratz' },
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

// 2. Define the main flow that orchestrates the entire process
const converseWithNativeTeacherFlow = ai.defineFlow(
  {
    name: 'converseWithNativeTeacherFlow',
    inputSchema: ConverseWithNativeTeacherInputSchema,
    outputSchema: ConverseWithNativeTeacherOutputSchema,
  },
  async ({ studentRecordingDataUri, conversationHistory }) => {
    let studentTranscript = "";
    let aiResponseText = "";

    // Step 1: Transcribe student's audio if it exists.
    if (studentRecordingDataUri) {
      const sttResponse = await ai.generate({
        model: googleAI.model('gemini-2.5-flash'),
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

    // Pre-process history for the template helper
    const historyForPrompt = conversationHistory.map(turn => ({
      ...turn,
      isUser: turn.role === 'user',
    }));

    // Step 2: Generate AI's text response based on transcript and history
    const { output } = await conversationalPrompt({
      history: historyForPrompt,
      studentTranscript: studentTranscript || undefined, 
    });

    aiResponseText = output?.aiResponseText || "";

    if (!aiResponseText) {
        console.error("AI did not generate a text response. Received:", output);
        // If AI fails to respond, generate a safe fallback response.
        aiResponseText = "Sorry, I'm having a little trouble right now. Could you say that again?";
    }

    // Step 3: Convert AI's text response to speech (TTS)
    const aiResponseAudioDataUri = await textToSpeech(aiResponseText);

    // Step 4: Return all the generated data
    return {
      studentTranscript: studentTranscript === "(The user did not say anything)" ? "" : studentTranscript,
      aiResponseText,
      aiResponseAudioDataUri,
    };
  }
);
