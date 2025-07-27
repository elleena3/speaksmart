'use server';

/**
 * @fileOverview A flow to analyze a user's handwriting from an image.
 * It provides a transcript, word-by-word analysis, and overall feedback.
 * 
 * - analyzeHandwriting - A function that takes an image data URI and returns detailed analysis.
 * - AnalyzeHandwritingInput - The input type for the flow.
 * - AnalyzeHandwritingOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { evaluationModels } from '@/lib/types';


const AnalyzeHandwritingInputSchema = z.object({
  imageDataUri: z.string().describe(
    "An image file of the user's handwriting, as a data URI."
  ),
  model: z.enum(evaluationModels).optional().default('gemini-2.5-flash'),
});
export type AnalyzeHandwritingInput = z.infer<typeof AnalyzeHandwritingInputSchema>;

const WordAnalysisSchema = z.object({
    word: z.string().describe("The transcribed word."),
    status: z.enum(['clear', 'needs_improvement']).describe("The legibility status of the word: 'clear' if easily readable, 'needs_improvement' if difficult to read."),
    feedback: z.string().optional().describe("Specific feedback on why the word needs improvement (e.g., 'The letter 'e' looks like 'o'')."),
});

const AnalyzeHandwritingOutputSchema = z.object({
  transcript: z.string().describe('The full transcript of what the AI could read from the image.'),
  overallFeedback: z.string().describe('Holistic feedback on the handwriting, covering aspects like spacing, consistency, and size, in Korean.'),
  wordAnalysis: z.array(WordAnalysisSchema).describe("A word-by-word analysis of the handwriting's legibility."),
});
export type AnalyzeHandwritingOutput = z.infer<typeof AnalyzeHandwritingOutputSchema>;


export async function analyzeHandwriting(input: AnalyzeHandwritingInput): Promise<AnalyzeHandwritingOutput> {
  const result = await analyzeHandwritingFlow(input);
  return result;
}

const handwritingAnalysisPrompt = ai.definePrompt({
    name: 'handwritingAnalysisPrompt',
    input: { schema: AnalyzeHandwritingInputSchema },
    output: { schema: AnalyzeHandwritingOutputSchema },
    prompt: `You are an expert handwriting analyst and teacher, specializing in providing feedback for English language learners. Your task is to evaluate a student's handwriting from an image. Provide all feedback in Korean.

Here is the data for analysis:
- Student's Handwritten Text (Image): 
{{media url=imageDataUri}}

Please perform the following steps:
1.  **Transcribe the Text:** Read the handwritten text in the image and convert it into a single string for the 'transcript'. If you cannot read any text, the transcript should be empty.
2.  **Perform Word-by-Word Analysis:** Go through the transcribed text word by word. For each word, create an object for the 'wordAnalysis' array.
    - 'word': The word you transcribed.
    - 'status': Set to 'clear' if the word is perfectly legible and well-formed. Set to 'needs_improvement' if any letter is unclear, misshapen, or ambiguous.
    - 'feedback': If the status is 'needs_improvement', provide a short, specific reason in Korean (e.g., "'a'와 'o'의 구분이 모호함", "'l'의 높이가 너무 낮음").
3.  **Provide Overall Feedback:** Write holistic, constructive feedback in Korean for the 'overallFeedback' field. Comment on the general legibility, spacing between words, consistency of letter size, and slant. Offer actionable advice for improvement.
4.  **Format the Output:** Return the full transcript, the word-by-word analysis array, and the overall feedback in the specified JSON format. If no text is detected, return an empty transcript, empty array, and feedback indicating no text was found.
`,
});

const analyzeHandwritingFlow = ai.defineFlow(
  {
    name: 'analyzeHandwritingFlow',
    inputSchema: AnalyzeHandwritingInputSchema,
    outputSchema: AnalyzeHandwritingOutputSchema,
  },
  async ({ imageDataUri, model }) => {
    const analysisModel = googleAI.model(model || 'gemini-2.5-flash');

    const { output } = await handwritingAnalysisPrompt(
      { imageDataUri, model },
      { model: analysisModel }
    );
    
    if (!output) {
      throw new Error("The AI model did not return a valid handwriting analysis.");
    }
    return output;
  }
);
