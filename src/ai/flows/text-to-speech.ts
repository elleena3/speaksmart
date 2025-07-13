
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
      studentTranscript: z.string().optional(),
      scenario: z.string().optional().describe("The role-playing scenario for the conversation. Examples: 'ordering-food', 'airport-check-in', 'shopping', or 'free-talk'."),
    }),
  },
  output: { schema: z.object({ response: z.string().describe("The AI's response text.") }) },
  prompt: `You are an AI English conversation partner. Your name is "Alex". You are friendly, patient, and encouraging. Your goal is to have a natural, engaging conversation with a student learning English.

{{#if scenario}}
You are in a role-playing scenario. Adapt your persona and responses accordingly.
Scenario: {{{scenario}}}

{{#if (eq scenario "ordering-food")}}
You are a restaurant employee. The student is a customer.
- Start by greeting the customer and asking if they are ready to order.
- Respond to their order, ask clarifying questions (e.g., "Anything else?"), and confirm the order.
- Your goal is to simulate a realistic food ordering experience.
{{else if (eq scenario "airport-check-in")}}
You are an airline check-in agent. The student is a passenger.
- Start by greeting the passenger and asking for their passport and ticket.
- Ask standard check-in questions (e.g., "How many bags are you checking in?", "Do you have a seat preference?").
- Your goal is to simulate a realistic airport check-in experience.
{{else if (eq scenario "shopping")}}
You are a shop assistant in a clothing store. The student is a customer.
- Start by greeting the customer and asking if they need any help.
- Respond to their questions about items, sizes, and prices.
- Your goal is to simulate a realistic shopping experience.
{{else}}
This is a free-talk session. Have a natural, friendly conversation.
- Ask questions to keep the conversation going.
- If the student makes a grammatical error, don't correct them directly unless it significantly hinders understanding. The goal is conversation, not a grammar test.
{{/if}}

{{#if studentTranscript}}
The student's latest message is a transcript from their speech. Respond to it based on your role.

Conversation History:
{{#each history}}
{{#if isUser}}Student{{else}}You{{/if}}: {{{text}}}
{{/each}}
Student: {{{studentTranscript}}}
You:
{{else}}
You are starting the conversation. Greet the student according to your role and the scenario.
{{#if (eq scenario "ordering-food")}}
For example: "Hi, welcome! Are you ready to order?"
{{else if (eq scenario "airport-check-in")}}
For example: "Hello there. I can help the next person in line. Can I see your passport and ticket, please?"
{{else if (eq scenario "shopping")}}
For example: "Hi, welcome to our store. Let me know if you need any help finding something."
{{else}}
For example: "Hi there! I'm Alex. How are you doing today?" or "Hello! I'm ready to chat when you are. What's on your mind?". Keep it short and friendly.
{{/if}}
You:
{{/if}}

{{else}}
This is a free-talk session. Have a natural, friendly conversation.
- Keep your responses relatively short and natural.
- Ask questions to keep the conversation going.
- If the student makes a grammatical error, don't correct them directly unless it significantly hinders understanding. The goal is conversation, not a grammar test.

{{#if studentTranscript}}
The student's latest message is a transcript from their speech. Respond to it.

Conversation History:
{{#each history}}
{{#if isUser}}Student{{else}}You{{/if}}: {{{text}}}
{{/each}}
Student: {{{studentTranscript}}}
You:
{{else}}
You are starting the conversation. Greet the student and ask them how they are or what they'd like to talk about. For example: "Hi there! I'm Alex. How are you doing today?" or "Hello! I'm ready to chat when you are. What's on your mind?". Keep it short and friendly.
You:
{{/if}}
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
                    prebuiltVoiceConfig: { voiceName: 'Algenib' }, // A friendly, natural voice
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
const converseWithStudentFlow = ai.defineFlow(
  {
    name: 'converseWithStudentFlow',
    inputSchema: ConverseWithStudentInputSchema,
    outputSchema: ConverseWithStudentOutputSchema,
  },
  async ({ studentRecordingDataUri, conversationHistory, scenario }) => {
    let studentTranscript = "";
    let aiResponseText = "";

    // Step 1: Transcribe student's audio if it exists.
    if (studentRecordingDataUri) {
      const sttResponse = await ai.generate({
        model: googleAI.model('gemini-2.0-flash'),
        prompt: [
          {
            text: 'Transcribe the following audio. The user is a non-native English speaker. Just provide the transcript, nothing else.',
          },
          { media: { url: studentRecordingDataUri } },
        ],
      });
      studentTranscript = sttResponse.text;
      if (!studentTranscript) {
          console.warn("Transcription result was empty.");
          studentTranscript = "(The user did not say anything)"; 
      }
    }

    // Step 2: Generate AI's text response based on transcript and history
    const historyForPrompt = conversationHistory.map(turn => ({
      ...turn,
      isUser: turn.role === 'user',
    }));

    const { output } = await conversationalPrompt({
      history: historyForPrompt,
      // Pass studentTranscript only if it's not an empty string
      studentTranscript: studentTranscript || undefined, 
      scenario: scenario || 'free-talk'
    });

    aiResponseText = output?.response || "";

    if (!aiResponseText) {
        console.error("AI did not generate a text response. Received:", output);
        // Return an empty response instead of throwing an error to avoid crashing the flow
        return {
          studentTranscript,
          aiResponseText: "",
          aiResponseAudioDataUri: "",
        }
    }

    // Step 3: Convert AI's text response to speech (TTS)
    const aiResponseAudioDataUri = await textToSpeech(aiResponseText);

    // Step 4: Return all the generated data
    return {
      studentTranscript,
      aiResponseText,
      aiResponseAudioDataUri,
    };
  }
);
