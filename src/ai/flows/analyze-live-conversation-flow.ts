'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const AnalyzeLiveConversationInputSchema = z.object({
    transcript: z.string().describe("The full transcript of the real-time conversation between User and AI."),
});
export type AnalyzeLiveConversationInput = z.infer<typeof AnalyzeLiveConversationInputSchema>;

const AnalyzeLiveConversationOutputSchema = z.object({
    overallScore: z.number().int().min(0).max(100).describe("Overall score 0-100"),
    grammarFeedback: z.string().describe("Feedback on grammar usage, with specific timestamp/turn references."),
    fluencyFeedback: z.string().describe("Feedback on conversational fluency and natural expressions."),
    overallFeedback: z.string().describe("Holistic summary in markdown (2 strengths, 2 weaknesses, 3 actionable tips).")
});
export type AnalyzeLiveConversationOutput = z.infer<typeof AnalyzeLiveConversationOutputSchema>;

export async function analyzeLiveConversation(input: AnalyzeLiveConversationInput): Promise<AnalyzeLiveConversationOutput> {
    const result = await analyzeLiveConversationFlow(input);
    return result;
}

const liveConversationAnalysisPrompt = ai.definePrompt({
    name: 'liveConversationAnalysisPrompt',
    model: googleAI.model('gemini-3.6-flash'),
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
        const { output } = await liveConversationAnalysisPrompt(input);
        if (!output) throw new Error("AI failed to evaluate live conversation.");
        return output;
    }
);
