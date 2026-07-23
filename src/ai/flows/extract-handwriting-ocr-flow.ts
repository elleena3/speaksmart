'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { evaluationModels } from '@/lib/types';

const ExtractHandwritingOcrInputSchema = z.object({
    studentSubmissionUri: z.string().describe(
        "The student's handwritten work as a data URI (image or PDF)."
    ),
    model: z.enum(evaluationModels).optional().default('googleai/gemini-3.6-flash'),
});

export type ExtractHandwritingOcrInput = z.infer<typeof ExtractHandwritingOcrInputSchema>;

const ExtractHandwritingOcrOutputSchema = z.object({
    rawText: z.string().describe('Exact, literal extraction of the handwritten text or math equations.'),
});
// We just want string output, so we could also just return text directly. But structured is fine.
export type ExtractHandwritingOcrOutput = z.infer<typeof ExtractHandwritingOcrOutputSchema>;

export async function extractHandwritingOcr(input: ExtractHandwritingOcrInput): Promise<string> {
    const result = await extractHandwritingOcrFlow(input);
    return result;
}

const extractHandwritingOcrPrompt = ai.definePrompt({
    name: 'extractHandwritingOcrPrompt',
    input: { schema: z.object({ studentSubmissionUri: z.string() }) },
    output: { format: 'text' },
    prompt: `You are an expert OCR system. Extract all handwritten text, math equations, and symbols from the following image or document exactly as they appear. 
Do NOT attempt to evaluate, correct, or format the text beyond accurately reflecting the original structure. For math equations, output them in properly formatted LaTeX wrapped in $$ or $ delimiters.

{{media url=studentSubmissionUri}}
`,
});

const extractHandwritingOcrFlow = ai.defineFlow(
    {
        name: 'extractHandwritingOcrFlow',
        inputSchema: ExtractHandwritingOcrInputSchema,
        outputSchema: z.string(),
    },
    async ({ model, ...input }) => {
        // Force a multimodal-capable model if needed, but flash is default
        const analysisModel = model || 'googleai/gemini-3.6-flash';

        const { text } = await extractHandwritingOcrPrompt(input, { model: analysisModel });

        if (!text) {
            throw new Error("The AI model did not return extracted text from the submission.");
        }
        return text.trim();
    }
);
