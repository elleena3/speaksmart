'use server';
/**
 * @fileOverview A flow to summarize a conversation history.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { ConversationTurnSchema } from '@/lib/types/ai-schemas';

export const SummarizeConversationHistoryInputSchema = z.object({
  conversationToSummarize: z.array(ConversationTurnSchema),
});

export const SummarizeConversationHistoryOutputSchema = z.object({
  summary: z.string(),
});

const summarizationPrompt = ai.definePrompt({
    name: 'conversationSummarizationPrompt',
    model: googleAI.model('gemini-2.5-flash-lite-preview-06-17'),
    input: { schema: SummarizeConversationHistoryInputSchema },
    output: { schema: SummarizeConversationHistoryOutputSchema },
    prompt: `You are a conversation summarizer. Your task is to create a concise, third-person summary of the provided conversation history. Focus on the key facts, decisions, and topics discussed.

Conversation History:
{{#each conversationToSummarize}}
{{role}}: {{{text}}}
{{/each}}

Please provide a brief summary of this conversation.`,
});

export const summarizeConversationHistoryFlow = ai.defineFlow(
    {
        name: 'summarizeConversationHistoryFlow',
        inputSchema: SummarizeConversationHistoryInputSchema,
        outputSchema: SummarizeConversationHistoryOutputSchema
    },
    async ({ conversationToSummarize }) => {
        if (conversationToSummarize.length === 0) {
            return { summary: "" };
        }
        
        const { output } = await summarizationPrompt({ conversationToSummarize });
        if (!output) {
            throw new Error("Failed to generate conversation summary.");
        }
        return output;
    }
);
