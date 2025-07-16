
'use server';

/**
 * @fileOverview A flow to analyze a user's reading of a given text.
 * It compares the user's audio recording with the original text to provide detailed feedback.
 * 
 * - analyzeReadAloud - A function that takes an audio data URI and the original text, returning detailed analysis.
 * - AnalyzeReadAloudInput - The input type for the flow.
 * - AnalyzeReadAloudOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const AnalyzeReadAloudInputSchema = z.object({
  audioDataUri: z.string().describe(
    "An audio file of the user reading the text, as a data URI."
  ),
  originalText: z.string().describe('The text that the user was supposed to read.'),
});
export type AnalyzeReadAloudInput = z.infer<typeof AnalyzeReadAloudInputSchema>;

const WordAnalysisSchema = z.object({
    word: z.string().describe("The word from the original text."),
    status: z.enum(['correct', 'incorrect', 'omitted', 'insertion']).describe("The status of the word: 'correct' if read correctly, 'incorrect' if mispronounced or substituted, 'omitted' if skipped. 'insertion' is for words the user said that were not in the text and has no 'word' field from original text."),
    spoken: z.string().optional().describe("The actual word spoken by the user if it was incorrect."),
});


const AnalyzeReadAloudOutputSchema = z.object({
  accuracy: z.number().int().min(0).max(100).describe('A score from 0-100 representing how accurately the user read the text (word-for-word match).'),
  fluency: z.number().int().min(0).max(100).describe('A score from 0-100 for the fluency of the reading (flow, pace, and rhythm).'),
  completionRate: z.number().int().min(0).max(100).describe('The percentage of the text that the user actually read.'),
  pronunciationScore: z.number().int().min(0).max(100).describe('A score from 0-100 for the pronunciation of the words.'),
  feedback: z.string().describe('Specific, constructive feedback on the user\'s reading performance, in Korean. It should highlight strengths and areas for improvement.'),
  userTranscript: z.string().describe('The transcript of what the user actually said.'),
  wordAnalysis: z.array(WordAnalysisSchema).describe("A word-by-word analysis comparing the original text to the user's transcript."),
});
export type AnalyzeReadAloudOutput = z.infer<typeof AnalyzeReadAloudOutputSchema>;

export async function analyzeReadAloud(input: AnalyzeReadAloudInput): Promise<AnalyzeReadAloudOutput> {
  const result = await analyzeReadAloudFlow(input);
  return result;
}

const readAloudAnalysisPrompt = ai.definePrompt({
    name: 'readAloudAnalysisPrompt',
    model: googleAI.model('gemini-2.5-flash'),
    input: { schema: AnalyzeReadAloudInputSchema },
    output: { schema: AnalyzeReadAloudOutputSchema },
    prompt: `You are an expert English reading and pronunciation coach. Your task is to evaluate a user's spoken English as they read a provided text aloud. Provide all feedback in Korean.

Here is the data for analysis:
- Original Text to be Read: 
"""
{{{originalText}}}
"""

- User's Audio Recording of them reading the text: 
{{media url=audioDataUri}}

Please perform the following steps:
1.  **Transcribe the User's Audio:** First, convert the user's audio into text. This is the 'userTranscript'.
2.  **Perform Word-by-Word Analysis:** Compare the 'userTranscript' to the 'originalText'. Create an array for 'wordAnalysis'. For each word in the original text, determine its status:
    - 'correct': The user said the word correctly.
    - 'incorrect': The user said a different word. Include the spoken word in the 'spoken' field.
    - 'omitted': The user skipped the word.
    User insertions (words spoken but not in the original text) should be ignored in this array.
3.  **Calculate Completion Rate:** Based on the word analysis, calculate what percentage of the original text the user actually attempted to read (correct + incorrect words) / (total words). If the audio is silent, completion rate is 0.
4.  **Calculate Accuracy Score:** Based on the word analysis, calculate an accuracy score from 0 to 100. (correct words) / (total words attempted).
5.  **Evaluate Fluency Score:** Listen to the audio for its flow, rhythm, and naturalness. Assign a fluency score from 0 to 100. Consider unnatural pauses, hesitations, and pace.
6.  **Evaluate Pronunciation Score:** Analyze the pronunciation of the words the user spoke. Assign a pronunciation score from 0 to 100 based on clarity, correctness of sounds, and intonation.
7.  **Provide Constructive Feedback:** Write specific, helpful feedback in Korean. This should cover all aspects evaluated: accuracy (mentioning specific words missed or read incorrectly), fluency, and pronunciation.
8.  **Format the Output:** Return all calculated scores, the feedback, the user transcript, and the 'wordAnalysis' array in the specified JSON format. If the audio is silent or contains no discernible speech, all scores should be 0, the feedback should state that no speech was detected, and all arrays should be empty.
`,
});

const analyzeReadAloudFlow = ai.defineFlow(
  {
    name: 'analyzeReadAloudFlow',
    inputSchema: AnalyzeReadAloudInputSchema,
    outputSchema: AnalyzeReadAloudOutputSchema,
  },
  async (input) => {
    const { output } = await readAloudAnalysisPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid analysis.");
    }
    return output;
  }
);
