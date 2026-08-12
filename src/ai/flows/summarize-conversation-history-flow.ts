
'use server';
import { requireUser } from '@/lib/auth-guard';
/**
 * @fileOverview A flow to summarize a conversation history.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import { ConversationTurnSchema } from '@/lib/types/ai-schemas';

const SummarizeConversationHistoryInputSchema = z.object({
  conversationToSummarize: z.array(ConversationTurnSchema),
});

const SummarizeConversationHistoryOutputSchema = z.object({
  summary: z.string(),
});

const summarizationPrompt = ai.definePrompt({
    name: 'conversationSummarizationPrompt',
    model: 'googleai/gemini-3.5-flash-lite',
    input: { schema: SummarizeConversationHistoryInputSchema },
    output: { schema: SummarizeConversationHistoryOutputSchema },
    prompt: `You are a conversation summarizer. Your task is to create a concise, third-person summary of the provided conversation history. Focus on the key facts, decisions, and topics discussed.

Conversation History:
{{#each conversationToSummarize}}
{{role}}: {{{text}}}
{{/each}}

Please provide a brief summary of this conversation.`,
});

const summarizeConversationHistoryFlowInner = ai.defineFlow(
    {
        name: 'summarizeConversationHistoryFlow',
        inputSchema: SummarizeConversationHistoryInputSchema,
        outputSchema: SummarizeConversationHistoryOutputSchema,
    },
    async (input) => {
        if (input.conversationToSummarize.length === 0) {
            return { summary: "" };
        }
        
        const { output } = await summarizationPrompt(input);
        if (!output) {
            throw new Error("Failed to generate conversation summary.");
        }
        return output;
    }
);

/** 서버 액션 진입점. 인증 없이 호출될 수 있어 호출자를 먼저 확인합니다. */
export async function summarizeConversationHistoryFlow(input: Parameters<typeof summarizeConversationHistoryFlowInner>[0]) {
  await requireUser();
  return summarizeConversationHistoryFlowInner(input);
}
