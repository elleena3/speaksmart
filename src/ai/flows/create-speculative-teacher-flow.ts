
'use server';

/**
 * @fileOverview A speculative flow for conversation that attempts to predict the AI response.
 * It uses an initial audio chunk for a speculative LLM call, and a final audio for confirmation.
 *
 * - converseWithSpeculativeTeacher - The main function for this experimental tool.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { ConversationTurnSchema } from '@/lib/types/ai-schemas';
import wav from 'wav';

// Schemas
const ConverseWithSpeculativeTeacherInputSchema = z.object({
  initialChunkDataUri: z.string().optional().describe("The first 2-second chunk of user's audio for speculation."),
  finalAudioDataUri: z.string().optional().describe("The full audio of the user's turn for confirmation."),
  conversationHistory: z.array(ConversationTurnSchema).describe('The history of the conversation so far.'),
  isInitialGreeting: z.boolean().optional(),
});
type ConverseWithSpeculativeTeacherInput = z.infer<typeof ConverseWithSpeculativeTeacherInputSchema>;

const ConverseWithSpeculativeTeacherOutputSchema = z.object({
  aiResponseText: z.string(),
  aiResponseAudioDataUri: z.string(),
  finalStudentTranscript: z.string(),
});
type ConverseWithSpeculativeTeacherOutput = z.infer<typeof ConverseWithSpeculativeTeacherOutputSchema>;


// Exported function
export async function converseWithSpeculativeTeacher(
  input: ConverseWithSpeculativeTeacherInput
): Promise<ConverseWithSpeculativeTeacherOutput> {
  return converseWithSpeculativeTeacherFlow(input);
}

// Helper functions (TTS, WAV conversion)
async function toWav(pcmData: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const writer = new wav.Writer({ channels: 1, sampleRate: 24000, bitDepth: 16 });
        const bufs: Buffer[] = [];
        writer.on('data', (chunk) => bufs.push(chunk));
        writer.on('end', () => resolve(Buffer.concat(bufs).toString('base64')));
        writer.on('error', reject);
        writer.write(pcmData);
        writer.end();
    });
}

async function textToSpeech(text: string): Promise<string> {
    const ttsResponse = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Algenib' } } } },
        prompt: text,
    });
    const audioMedia = ttsResponse.media;
    if (!audioMedia) throw new Error('TTS did not return any audio media.');
    const pcmBuffer = Buffer.from(audioMedia.url.substring(audioMedia.url.indexOf(',') + 1), 'base64');
    return `data:audio/wav;base64,${await toWav(pcmBuffer)}`;
}


// Prompts
const sttPrompt = ai.definePrompt({
    name: 'speculativeSttPrompt',
    model: googleAI.model('gemini-2.5-flash'),
    input: { schema: z.object({ audioDataUri: z.string() })},
    prompt: 'Transcribe this English audio. If there is no discernible speech, return an empty string.\nAudio: {{media url=audioDataUri}}',
});

const conversationalPrompt = ai.definePrompt({
  name: 'speculativeConversationalPrompt',
  model: googleAI.model('gemini-2.5-flash-lite-preview-06-17'),
  input: {
    schema: z.object({
      studentTranscript: z.string().optional(),
      history: z.array(ConversationTurnSchema.extend({ isUser: z.boolean() })),
    })
  },
  output: { schema: z.object({ aiResponseText: z.string() }) },
  prompt: `You are an AI English conversation partner named "Dr. Alex". Your persona is friendly, patient, and knowledgeable.
Your goals are to have a natural conversation, adapting your language to the user's level.

IMPORTANT RULE: If the user's transcript is empty, indicates no speech, or is nonsensical, ask them to speak again (e.g., "Sorry, I couldn't hear you clearly.").

Conversation History:
{{#each history}}
{{#if isUser}}User{{else}}You{{/if}}: {{{text}}}
{{/each}}

{{#if studentTranscript}}
User's latest message: {{{studentTranscript}}}
Your response:
{{else}}
You are starting the conversation. Greet the user and introduce yourself.
Your response:
{{/if}}
`,
});


// Main Flow
const converseWithSpeculativeTeacherFlow = ai.defineFlow(
  {
    name: 'converseWithSpeculativeTeacherFlow',
    inputSchema: ConverseWithSpeculativeTeacherInputSchema,
    outputSchema: ConverseWithSpeculativeTeacherOutputSchema,
  },
  async (input) => {
    
    // Case 1: Initial greeting from AI
    if (input.isInitialGreeting) {
        const { output } = await conversationalPrompt({ history: [] });
        const aiResponseText = output?.aiResponseText || "Hello! I'm Dr. Alex. What's on your mind today?";
        const aiResponseAudioDataUri = await textToSpeech(aiResponseText);
        return { aiResponseText, aiResponseAudioDataUri, finalStudentTranscript: "" };
    }

    if (!input.initialChunkDataUri || !input.finalAudioDataUri) {
        throw new Error("Initial chunk and final audio are both required for a conversational turn.");
    }
    
    // Case 2: Process a conversational turn
    // Step 1: Transcribe initial chunk and final audio in parallel
    const [initialTranscriptionResult, finalTranscriptionResult] = await Promise.all([
        sttPrompt({ audioDataUri: input.initialChunkDataUri }),
        sttPrompt({ audioDataUri: input.finalAudioDataUri }),
    ]);

    const initialTranscript = initialTranscriptionResult.text;
    const finalTranscript = finalTranscriptionResult.text;

    // Step 2: Get a speculative response based on the *initial* transcript
    const historyForPrompt = input.conversationHistory.map(turn => ({...turn, isUser: turn.role === 'user'}));
    
    const speculativeResponsePromise = conversationalPrompt({
        history: historyForPrompt,
        studentTranscript: initialTranscript.trim() || finalTranscript.trim() // Fallback to final if initial is empty
    });

    // Step 3: Compare transcripts. If they are different, we need a new response.
    // A simple length check is a decent heuristic for this experiment.
    const isSpeculationValid = finalTranscript.startsWith(initialTranscript) && (finalTranscript.length - initialTranscript.length < 50);

    let aiResponseText;

    if (isSpeculationValid) {
        // Use the speculative response
        const { output } = await speculativeResponsePromise;
        aiResponseText = output?.aiResponseText || "I see. Could you tell me more?";
    } else {
        // Get a new response based on the final, more accurate transcript
        const { output } = await conversationalPrompt({
            history: historyForPrompt,
            studentTranscript: finalTranscript
        });
        aiResponseText = output?.aiResponseText || "That's interesting. Please continue.";
    }

    // Step 4: Generate TTS for the chosen response
    const aiResponseAudioDataUri = await textToSpeech(aiResponseText);
    
    return {
        aiResponseText,
        aiResponseAudioDataUri,
        finalStudentTranscript: finalTranscript,
    };
  }
);
