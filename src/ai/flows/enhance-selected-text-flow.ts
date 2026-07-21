
'use server';

/**
 * @fileOverview A flow to analyze a user-selected text snippet from a larger passage.
 * It corrects imprecise selections and provides translation, definition, or explanation.
 *
 * - enhanceSelectedText - The main function to call for this feature.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import { EnhanceSelectedTextInputSchema, EnhanceSelectedTextOutputSchema, EnhanceSelectedTextInput, EnhanceSelectedTextOutput } from '@/lib/types/ai-schemas';

export async function enhanceSelectedText(input: EnhanceSelectedTextInput): Promise<EnhanceSelectedTextOutput> {
  const result = await enhanceSelectedTextFlow(input);
  return result;
}

const enhanceTextPrompt = ai.definePrompt({
    name: 'enhanceTextPrompt',
    model: googleAI.model('gemini-3.5-flash'),
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
