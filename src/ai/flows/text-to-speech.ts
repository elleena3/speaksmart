
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
} from '@/lib/types/ai-schemas';
import wav from 'wav';

export async function converseWithStudent(
  input: ConverseWithStudentInput
): Promise<ConverseWithStudentOutput> {
  return converseWithStudentFlow(input);
}


// 1. Define the prompt for generating the conversational text response
const conversationalPrompt = ai.definePrompt({
  name: 'conversationalPrompt',
  input: {
    schema: ConverseWithStudentInputSchema.pick({
      conversationHistory: true,
      studentTranscript: true,
      scenario: true,
      scenarioPrompt: true, // Use the prompt from the schema
    }).extend({
        history: ConverseWithStudentInputSchema.shape.conversationHistory, // for handlebars
    })
  },
  output: { schema: ConverseWithStudentOutputSchema.pick({ aiResponseText: true }) },
  prompt: `You are an AI English conversation partner. Your name is "Alex". You are friendly, patient, and encouraging. Your goal is to have a natural, engaging conversation with a student learning English.

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
{{#if (eq role "user")}}Student{{else}}You{{/if}}: {{{text}}}
{{/each}}

{{#if studentTranscript}}
The student's latest message is a transcript from their speech. Respond to it.
Student: {{{studentTranscript}}}
You:
{{else}}
You are starting the conversation. Greet the student according to your role and the situation. Keep it short and friendly.
For example, if you are a shop assistant: "Hi, welcome to our store. Let me know if you need any help finding something."
For a free talk, you could say: "Hi there! I'm Alex. How are you doing today?"
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
  async ({ studentRecordingDataUri, conversationHistory, scenario, scenarioPrompt }) => {
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
    const { output } = await conversationalPrompt({
      history: conversationHistory,
      studentTranscript: studentTranscript || undefined, 
      scenario: scenario || 'free-talk',
      scenarioPrompt: scenarioPrompt,
      conversationHistory: conversationHistory,
    });

    aiResponseText = output?.aiResponseText || "";

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
