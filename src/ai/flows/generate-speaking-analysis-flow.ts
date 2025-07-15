
'use server';

/**
 * @fileOverview This is an OBSOLETE comprehensive flow that analyzes a student's spoken English performance.
 * Its functionality has been split into generate-monologue-analysis-flow.ts and generate-dialogue-analysis-flow.ts.
 * This file can be safely deleted.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import {
  GenerateMonologueAnalysisInputSchema,
  ContentAnalysisOutputSchema,
  PronunciationAnalysisOutputSchema,
  CombinedAnalysisOutputSchema,
  type GenerateMonologueAnalysisInput,
} from '@/lib/types/ai-schemas';

/**
 * OBSOLETE Main exported function.
 */
export async function generateSpeakingAnalysis(
    input: GenerateMonologueAnalysisInput
): Promise<z.infer<typeof CombinedAnalysisOutputSchema>> {
  throw new Error("This flow is obsolete. Use generateMonologueAnalysis or generateDialogueAnalysis instead.");
}

const generateSpeakingAnalysisFlow = ai.defineFlow(
  {
    name: 'OBSOLETE_generateSpeakingAnalysisFlow',
    inputSchema: GenerateMonologueAnalysisInputSchema,
    outputSchema: CombinedAnalysisOutputSchema,
  },
  async (input) => {
    throw new Error("This flow is obsolete. Use generateMonologueAnalysis or generateDialogueAnalysis instead.");
  }
);
