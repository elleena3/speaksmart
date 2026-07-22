'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GetOpenAiLiveSessionTokenInputSchema = z.object({
    voice: z.enum(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse']).optional().default('alloy'),
    model: z.string().optional().default('gpt-4o-mini-realtime-preview-2024-12-17')
});
export type GetOpenAiLiveSessionTokenInput = z.infer<typeof GetOpenAiLiveSessionTokenInputSchema>;

const GetOpenAiLiveSessionTokenOutputSchema = z.object({
    client_secret: z.object({
        value: z.string(),
        expires_at: z.number()
    })
});

export type GetOpenAiLiveSessionTokenOutput = z.infer<typeof GetOpenAiLiveSessionTokenOutputSchema>;

export async function getOpenAiLiveSessionToken(input?: GetOpenAiLiveSessionTokenInput): Promise<GetOpenAiLiveSessionTokenOutput> {
    return getOpenAiLiveSessionTokenFlow((input || {}) as GetOpenAiLiveSessionTokenInput);
}

const getOpenAiLiveSessionTokenFlow = ai.defineFlow(
    {
        name: 'getOpenAiLiveSessionTokenFlow',
        inputSchema: GetOpenAiLiveSessionTokenInputSchema,
        outputSchema: GetOpenAiLiveSessionTokenOutputSchema,
    },
    async ({ voice, model }) => {
        // Generate an ephemeral token from OpenAI using the stored backend API Key
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OPENAI_API_KEY is not configured on the server.");

        const reqBody = {
            "model": model,
            "voice": voice,
            "instructions": "You are a friendly native English tutor. Speak naturally and converse interactively with the user."
        };

        const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(reqBody),
        });

        if (!response.ok) {
            const errObj = await response.json().catch(() => ({}));
            console.error("OpenAI Realtime Session Auth Error:", errObj);
            throw new Error(`Failed to generate OpenAI ephemeral token: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    }
);
