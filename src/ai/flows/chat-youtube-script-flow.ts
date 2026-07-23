'use server';
/**
 * @fileOverview A flow to chat with a YouTube transcript context.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';
import { MessageData } from 'genkit';

const ChatYoutubeScriptInputSchema = z.object({
    transcript: z.string().describe("The entire transcript with timestamps included."),
    messageHistory: z.array(z.object({
        role: z.enum(['user', 'model', 'system']),
        content: z.array(z.object({
            text: z.string()
        }))
    })).describe("Previous messages in the chat."),
    evaluationModel: z.string().optional().describe("The AI model to use for the chat. Defaults to Gemini 3.1 Pro."),
});

export type ChatYoutubeScriptInput = z.infer<typeof ChatYoutubeScriptInputSchema>;

const ChatYoutubeScriptOutputSchema = z.object({
    reply: z.string().describe("The AI's response to the user's latest question."),
});
export type ChatYoutubeScriptOutput = z.infer<typeof ChatYoutubeScriptOutputSchema>;

export async function chatYoutubeScript(input: ChatYoutubeScriptInput): Promise<ChatYoutubeScriptOutput> {
    return chatYoutubeScriptFlow(input);
}

const chatYoutubeScriptFlow = ai.defineFlow(
    {
        name: 'chatYoutubeScriptFlow',
        inputSchema: ChatYoutubeScriptInputSchema,
        outputSchema: ChatYoutubeScriptOutputSchema,
    },
    async ({ transcript, messageHistory, evaluationModel }) => {
        try {
            const modelToUse = evaluationModel || 'googleai/gemini-3.1-pro-preview';
            console.log(`Starting Youtube Chat Flow with model: ${modelToUse}`);

            const systemPrompt = `You are a helpful AI assistant that answers questions specifically based on the provided YouTube video transcript.
The transcript contains timecodes like [MM:SS]. If the user asks for detailed information, quote the timestamp where relevant.
Do not hallucinate external facts. If the information is not in the transcript, state that it's not discussed in the video.
Answer in extremely natural and highly professional Korean.

<transcript_context>
${transcript}
</transcript_context>
`;

            const messages = [
                { role: 'system', content: [{ text: systemPrompt }] },
                ...messageHistory
            ] as MessageData[];

            const { text } = await ai.generate({
                model: modelToUse,
                messages: messages
            });

            return { reply: text };

        } catch (error: any) {
            console.error("An error occurred during YouTube Chat Flow:", error);
            throw new Error(error.message || "AI 채팅 중 알 수 없는 오류가 발생했습니다.");
        }
    }
);
