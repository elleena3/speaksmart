'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
// 'use server' 파일은 async 함수만 export 할 수 있으므로 상수는 별도 모듈에 둡니다.
import { REALTIME_INSTRUCTIONS } from '@/lib/realtime-config';

const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'] as const;

const GetOpenAiLiveSessionTokenInputSchema = z.object({
    voice: z.enum(OPENAI_VOICES).optional().default('alloy'),
    model: z.string().optional().default('gpt-realtime-2.1-mini'),
});
export type GetOpenAiLiveSessionTokenInput = z.infer<typeof GetOpenAiLiveSessionTokenInputSchema>;

// GA 엔드포인트는 { value, expires_at, session } 을 평평하게 돌려줍니다.
// (베타에서는 client_secret 으로 한 번 감싸져 있었습니다.)
const GetOpenAiLiveSessionTokenOutputSchema = z.object({
    value: z.string(),
    expires_at: z.number(),
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

        // GA 형식: 설정은 모두 session 안에 들어가고 type: 'realtime' 이 필요합니다.
        // 음성은 audio.output.voice 로 지정합니다.
        const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                expires_after: { anchor: 'created_at', seconds: 600 },
                session: {
                    type: 'realtime',
                    model,
                    instructions: REALTIME_INSTRUCTIONS,
                    audio: {
                        output: { voice },
                    },
                },
            }),
        });

        if (!response.ok) {
            // 원문을 그대로 남겨야 어떤 필드가 거부됐는지 알 수 있습니다.
            const detail = await response.text().catch(() => '');
            console.error("OpenAI Realtime Session Auth Error:", response.status, detail);
            throw new Error(`Failed to generate OpenAI ephemeral token: ${response.status} ${response.statusText} ${detail}`);
        }

        const data = await response.json();
        return { value: data.value, expires_at: data.expires_at };
    }
);
