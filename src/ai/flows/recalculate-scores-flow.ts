
'use server';
/**
 * @fileOverview A flow to recalculate rubric scores from the stored AI feedback text.
 * 
 * - recalculateScores - A function that takes a result ID and re-parses the scores.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { StudentResult, RubricScores } from '@/lib/types';


const RecalculateInputSchema = z.object({
  resultId: z.string().describe('The Firestore document ID of the result to recalculate.'),
});
type RecalculateInput = z.infer<typeof RecalculateInputSchema>;

export async function recalculateScores(input: RecalculateInput): Promise<{ success: boolean; message?: string }> {
  return recalculateScoresFlow(input);
}


// This parsing logic is now centralized here.
const parseScore = (text: string, category: string): number => {
    // A more flexible regex that doesn't rely on emojis or exact spacing
    const regex = new RegExp(`${category}[\\s\\S]*?점수[^\\d]*(\\d)`);
    const match = text.match(regex);
    return match ? parseInt(match[1], 10) : 0;
};


const recalculateScoresFlow = ai.defineFlow(
  {
    name: 'recalculateScoresFlow',
    inputSchema: RecalculateInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string().optional() }),
  },
  async ({ resultId }) => {
    try {
        console.log(`[Recalculate Flow] Starting recalculation for result ID: ${resultId}`);
        const resultRef = doc(db, 'results', resultId);
        const resultSnap = await getDoc(resultRef);

        if (!resultSnap.exists()) {
            throw new Error(`Result document with ID ${resultId} not found.`);
        }

        const resultData = resultSnap.data() as StudentResult;

        if (!resultData.aiFeedback || !resultData.aiFeedback.includes("종합 분석 리포트")) {
            return { success: false, message: 'This result does not appear to be a rubric-based evaluation.' };
        }
        
        const rubricText = resultData.aiFeedback;

        const isDialogue = resultData.assessmentType === 'dialogue';

        const newRubricScores: RubricScores = {
            fluency: parseScore(rubricText, '유창성'),
            pronunciation: parseScore(rubricText, '발음 및 억양'),
            grammar: parseScore(rubricText, '문법'),
            vocabulary: parseScore(rubricText, '어휘'),
            interaction: isDialogue ? parseScore(rubricText, '내용 이해 및 상호작용') : undefined,
        };

        const contentScoreItems = [newRubricScores.fluency, newRubricScores.grammar, newRubricScores.vocabulary];
        if (isDialogue && newRubricScores.interaction) {
            contentScoreItems.push(newRubricScores.interaction);
        }
        
        const newContentScore = Math.round((contentScoreItems.reduce((a, b) => a + b, 0) / contentScoreItems.length) * 20);
        const newPronunciationScore = newRubricScores.pronunciation * 20;

        await updateDoc(resultRef, {
            rubricScores: newRubricScores,
            contentScore: newContentScore,
            pronunciationScore: newPronunciationScore,
        });

        console.log(`[Recalculate Flow] Successfully recalculated scores for ${resultId}`);
        return { success: true, message: 'Scores recalculated successfully.' };

    } catch (e: any) {
        console.error(`[Recalculate Flow] An error occurred during recalculation for ${resultId}:`, e);
        throw e;
    }
  }
);
