
'use server';

/**
 * @fileOverview Converts text to speech and handles conversational AI responses.
 *
 * - converseWithStudent - A function that takes student audio, gets a conversational response, and returns AI audio.
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
} from '@/lib/types/ai-schemas';
import wav from 'wav';
import { evaluationModels } from '@/lib/types';

export async function converseWithStudent(
  input: ConverseWithStudentInput
): Promise<ConverseWithStudentOutput> {
  return converseWithStudentFlow(input);
}

// 1. Define the prompt for generating the conversational text response
const createConversationalPrompt = (modelName: z.infer<typeof evaluationModels[number]>) => {
    return ai.definePrompt({
      name: `conversationalPrompt_${modelName.replace(/[-.]/g, '_')}`,
      model: googleAI.model(modelName),
      input: {
        schema: ConverseWithStudentInputSchema.pick({
          studentTranscript: true,
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

    {{#if studentTranscript}}
    The student's latest message is a transcript from their speech. Respond to it.
    Student: {{{studentTranscript}}}
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
async function textToSpeech(text: string, voiceName: string = 'achernar'): Promise<string> {
    const ttsResponse = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName as any }, 
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
  async ({ studentRecordingDataUri, conversationHistory, scenario, scenarioPrompt, aiVoice, evaluationModel }) => {
    let studentTranscript = "";
    let aiResponseText = "";
    
    const model = evaluationModel || 'gemini-2.5-flash-lite-preview-06-17';
    const conversationalPrompt = createConversationalPrompt(model);


    // Step 1: Transcribe student's audio if it exists.
    if (studentRecordingDataUri) {
      const sttResponse = await ai.generate({
        model: googleAI.model(model),
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
      scenario: scenario || 'free-talk',
      scenarioPrompt: scenarioPrompt,
      conversationHistory: conversationHistory,
      aiVoice: aiVoice || 'achernar',
    });

    aiResponseText = output?.aiResponseText || "";

    if (!aiResponseText) {
        console.error("AI did not generate a text response. Received:", output);
        // If AI fails to respond, generate a safe fallback response.
        aiResponseText = "Sorry, I'm having a little trouble right now. Could you say that again?";
    }

    // Step 3: Convert AI's text response to speech (TTS)
    const aiResponseAudioDataUri = await textToSpeech(aiResponseText, aiVoice);

    // Step 4: Return all the generated data
    return {
      studentTranscript: studentTranscript === "(The user did not say anything)" ? "" : studentTranscript,
      aiResponseText,
      aiResponseAudioDataUri,
    };
  }
);
