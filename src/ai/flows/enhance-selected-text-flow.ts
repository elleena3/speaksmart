
'use server';

/**
 * @fileOverview A flow to analyze a user-selected text snippet from a larger passage.
 * It corrects imprecise selections and provides translation, definition, or explanation.
 *
 * - enhanceSelectedText - The main function to call for this feature.
 * - EnhanceSelectedTextInput - The input type for the flow.
 * - EnhanceSelectedTextOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

export const EnhanceSelectedTextInputSchema = z.object({
  selectedText: z.string().describe("The (potentially imprecise) text snippet selected by the user."),
  fullSentenceContext: z.string().describe("The full sentence or paragraph containing the selected text, for context."),
  action: z.enum(['translate', 'define', 'explain']).describe("The action to perform on the corrected text."),
});
export type EnhanceSelectedTextInput = z.infer<typeof EnhanceSelectedTextInputSchema>;

export const EnhanceSelectedTextOutputSchema = z.object({
  correctedText: z.string().describe("The most likely word or phrase the user intended to select."),
  result: z.string().describe("The result of the requested action (translation, definition, or explanation) in Korean."),
});
export type EnhanceSelectedTextOutput = z.infer<typeof EnhanceSelectedTextOutputSchema>;


export async function enhanceSelectedText(input: EnhanceSelectedTextInput): Promise<EnhanceSelectedTextOutput> {
  const result = await enhanceSelectedTextFlow(input);
  return result;
}

const enhanceTextPrompt = ai.definePrompt({
    name: 'enhanceTextPrompt',
    model: googleAI.model('gemini-2.5-flash'),
    input: { schema: EnhanceSelectedTextInputSchema },
    output: { schema: EnhanceSelectedTextOutputSchema },
    prompt: `You are an expert English language teaching assistant. A user has selected a snippet of text from a larger sentence to get help. Your task is to first determine the user's true intended selection, and then perform a requested action on that corrected text. All output text for the user must be in Korean.

### Context
-   **Full Sentence Context:** "{{fullSentenceContext}}"
-   **User's Selected Text Snippet:** "{{selectedText}}"

### Your Tasks

1.  **Correct the Selection:**
    -   Analyze the "User's Selected Text Snippet" in the context of the "Full Sentence Context".
    -   The user's selection might be imprecise (e.g., missing letters, part of a word).
    -   Determine the most logical, complete, and grammatically sound word or phrase the user likely intended to select. This is the 'correctedText'. For example, if the user selects 'universally acknowledg', you should correct it to 'universally acknowledged'.

2.  **Perform the Requested Action on the 'correctedText':**
    -   The user wants to perform the following action: **{{action}}**
    -   **If action is 'translate':** Provide a natural Korean translation of the 'correctedText'.
    -   **If action is 'define':** Provide a clear, dictionary-style definition of the 'correctedText' in Korean. Include the part of speech (e.g., 명사, 동사).
    -   **If action is 'explain':** Provide a simple grammatical explanation or usage notes for the 'correctedText' in Korean. Explain its role in the sentence or any notable nuances.

3.  **Format the Output:** Return the 'correctedText' and the 'result' of the action in the specified JSON format.
`,
});

const enhanceSelectedTextFlow = ai.defineFlow(
  {
    name: 'enhanceSelectedTextFlow',
    inputSchema: EnhanceSelectedTextInputSchema,
    outputSchema: EnhanceSelectedTextOutputSchema,
  },
  async (input) => {
    const { output } = await enhanceTextPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid analysis for the selected text.");
    }
    return output;
  }
);
