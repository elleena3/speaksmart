
'use server';

/**
 * @fileOverview Converts audio to speech and handles conversational AI responses.
 * This version is a practice tool that uses a specific voice profile similar to en-US-Neural2-A.
 *
 * - converseWithNeural2Teacher - A function that takes user audio and returns AI audio with a specific voice.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import {
  ConversationTurnSchema,
} from '@/lib/types/ai-schemas';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';


const ConverseWithNeural2TeacherInputSchema = z.object({
  studentRecordingDataUri: z
    .string()
    .describe(
      "The user's voice recording as a data URI."
    ).nullable(),
  conversationHistory: z
    .array(ConversationTurnSchema)
    .describe('The history of the conversation so far.'),
});
type ConverseWithNeural2TeacherInput = z.infer<typeof ConverseWithNeural2TeacherInputSchema>;

const ConverseWithNeural2TeacherOutputSchema = z.object({
  aiResponseText: z.string().describe('The text of the AI conversational partner.'),
  aiResponseAudioDataUri: z.string().describe("The AI's response as a playable audio data URI."),
  studentTranscript: z.string().describe("The transcript of the user's speech."),
});
type ConverseWithNeural2TeacherOutput = z.infer<typeof ConverseWithNeural2TeacherOutputSchema>;


export async function converseWithNeural2Teacher(
  input: ConverseWithNeural2TeacherInput
): Promise<ConverseWithNeural2TeacherOutput> {
  return converseWithNeural2TeacherFlow(input);
}

const conversationalPrompt = ai.definePrompt({
  name: 'neural2TeacherConversationalPrompt',
  model: googleAI.model('gemini-2.5-flash-lite-preview-06-17'),
  input: {
    schema: z.object({
      studentTranscript: z.string().optional(),
      history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
    })
  },
  output: { schema: z.object({ aiResponseText: z.string() }) },
  prompt: `You are an AI English conversation partner. Your name is "Puck". Your persona is friendly, patient, and clear-spoken.

Your primary goal is to have a natural, engaging conversation in English.
- Keep your responses relatively short and easy to understand.
- Ask questions to keep the conversation going.

IMPORTANT RULE: If the user's transcript is empty or indicates no speech, you MUST ask them to speak again, for example: "Sorry, I didn't catch that." or "I couldn't hear you, can you repeat that?".

Conversation History (if any):
{{#each history}}
{{#if isUser}}Student{{else}}You{{/if}}: {{{text}}}
{{/each}}

{{#if studentTranscript}}
The student's latest message is a transcript from their speech. Respond to it naturally.
Student: {{{studentTranscript}}}
You:
{{else}}
You are starting the conversation. Greet the student and introduce yourself.
Example: "Hello! I'm Puck. How are you doing today?"
You:
{{/if}}
`,
});

// Use Google Cloud Text-to-Speech API directly
async function textToSpeech(text: string): Promise<string> {
  try {
    const ttsClient = new TextToSpeechClient();
    const request = {
      input: { text: text },
      voice: { languageCode: 'en-US', name: 'en-US-Neural2-A' },
      audioConfig: { audioEncoding: 'MP3' as const },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    
    if (!response.audioContent) {
      throw new Error("Cloud TTS did not return audio content.");
    }
    
    const audioContent = Buffer.from(response.audioContent).toString('base64');
    return `data:audio/mp3;base64,${audioContent}`;

  } catch (error) {
    console.error("Error calling Google Cloud TTS API:", error);
    // As a fallback, throw an error to be caught by the main flow.
    throw new Error("Failed to generate speech using Google Cloud TTS.");
  }
}


const converseWithNeural2TeacherFlow = ai.defineFlow(
  {
    name: 'converseWithNeural2TeacherFlow',
    inputSchema: ConverseWithNeural2TeacherInputSchema,
    outputSchema: ConverseWithNeural2TeacherOutputSchema,
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
        aiResponseText = "Sorry, I'm having a little trouble right now. Could you say that again?";
    }

    // Step 3: Convert AI's text response to speech (TTS) using the correct API
    const aiResponseAudioDataUri = await textToSpeech(aiResponseText);

    return {
      studentTranscript: studentTranscript === "(The user did not say anything)" ? "" : studentTranscript,
      aiResponseText,
      aiResponseAudioDataUri,
    };
  }
);
