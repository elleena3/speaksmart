'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const AnalyzeLiveConversationInputSchema = z.object({
    transcript: z.string().describe("The full transcript of the real-time conversation between User and AI."),
    evaluationModel: z.string().optional().describe("Dynamic model to use for scoring (e.g., openai/gpt-5.6-sol or googleai/gemini-3.1-pro-preview)."),
});
export type AnalyzeLiveConversationInput = z.infer<typeof AnalyzeLiveConversationInputSchema>;

const AnalyzeLiveConversationOutputSchema = z.object({
    overallScore: z.number().int().min(0).max(100).describe("Overall score 0-100"),
    grammarFeedback: z.string().describe("Feedback on grammar usage, with specific timestamp/turn references."),
    fluencyFeedback: z.string().describe("Feedback on conversational fluency and natural expressions."),
    overallFeedback: z.string().describe("Holistic summary in markdown (2 strengths, 2 weaknesses, 3 actionable tips).")
});
export type AnalyzeLiveConversationOutput = z.infer<typeof AnalyzeLiveConversationOutputSchema>;

/**
 * 서버 액션에서 예외를 던지면 Next.js가 프로덕션에서 메시지를 지우고 digest만 남깁니다.
 * 그러면 화면에는 "An error occurred in the Server Components render..." 만 뜨고
 * 원인을 알 수 없어 매번 서버 로그를 뒤져야 합니다.
 * 그래서 실패를 예외가 아니라 값으로 돌려줍니다.
 */
export type AnalyzeLiveConversationResult =
    | { ok: true; data: AnalyzeLiveConversationOutput }
    | { ok: false; error: string };

export async function analyzeLiveConversation(input: AnalyzeLiveConversationInput): Promise<AnalyzeLiveConversationResult> {
    try {
        const data = await analyzeLiveConversationFlow(input);
        return { ok: true, data };
    } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        console.error('analyzeLiveConversation 실패:', detail);
        return { ok: false, error: detail };
    }
}

const liveConversationAnalysisPrompt = ai.definePrompt({
    name: 'liveConversationAnalysisPrompt',
    model: 'gemini-3.6-flash',
    input: { schema: AnalyzeLiveConversationInputSchema },
    output: { schema: AnalyzeLiveConversationOutputSchema },
    prompt: `You are an expert native English AI tutor evaluating a recent real-time conversation you had with a student.
    
### Conversation Transcript:
{{{transcript}}}

### Evaluation Tasks:
1. **Grammar & Vocabulary (\`grammarFeedback\`)**: Identify specific grammar or vocabulary mistakes from the user's transcript. Suggest better alternatives. Use polite Korean.
2. **Fluency (\`fluencyFeedback\`)**: Assess how natural the user sounded. Did they use appropriate idioms? Suggest more native-like expressions.
3. **Score (\`overallScore\`)**: 0 to 100 based on general clarity and accuracy.
4. **Overall (\`overallFeedback\`)**: MUST be in markdown. Summarize 2 distinct strengths, 2 areas to improve, and 3 clear tips for next time.

All feedback MUST be in Korean. Format strictly to JSON schema.
`,
});

const analyzeLiveConversationFlow = ai.defineFlow(
    {
        name: 'analyzeLiveConversationFlow',
        inputSchema: AnalyzeLiveConversationInputSchema,
        outputSchema: AnalyzeLiveConversationOutputSchema,
    },
    async (input) => {
        const modelToUse = input.evaluationModel || 'googleai/gemini-3.6-flash';
        console.log(`Analyzing conversational feedback using model: ${modelToUse}`);
        const { output } = await liveConversationAnalysisPrompt(input, { model: modelToUse });
        if (!output) throw new Error("AI failed to evaluate live conversation.");
        return output;
    }
);
