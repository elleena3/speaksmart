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

        const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: model,
                modalities: ["audio", "text"],
                instructions: "You are a friendly native English tutor. Speak naturally and converse interactively with the user.",
            }),
        });

        if (!response.ok) {
            // Note: The OpenAI realtime endpoints might reject invalid configurations. 
            // We can fallback to an empty payload `{}` if we receive a 400.
            const errObj = await response.json().catch(() => ({}));

            if (response.status === 400) {
                console.warn("OpenAI API rejected session config, attempting empty payload fallback.", errObj);
                const retryResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({}),
                });

                if (retryResponse.ok) {
                    const data = await retryResponse.json();
                    return { client_secret: data }; // Map so client receives expected format
                }
            }

            console.error("OpenAI Realtime Session Auth Error:", errObj);
            throw new Error(`Failed to generate OpenAI ephemeral token: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        // The new client_secrets endpoint returns { value, expires_at } directly.
        // If the 'client_secret' field doesn't exist, we wrap it to ensure backwards compatibility with our Zod schema.
        if (!data.client_secret) {
            return { client_secret: { value: data.client_secret?.value || data.value, expires_at: data.client_secret?.expires_at || data.expires_at } };
        }
        return data;
    }
);
