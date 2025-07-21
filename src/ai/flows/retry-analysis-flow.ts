
'use server';
/**
 * @fileOverview A flow to retry a failed analysis using a saved recording URL.
 * 
 * - retryAnalysis - A function that takes a result ID and re-triggers the appropriate analysis flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateMonologueAnalysisFlow } from './generate-monologue-analysis-flow';
import { generateDialogueAnalysis } from './generate-dialogue-analysis-flow';
import { type TeacherAssessment, type StudentResult } from '@/lib/types';


export const RetryAnalysisInputSchema = z.object({
  resultId: z.string().describe('The Firestore document ID of the result to retry.'),
});
export type RetryAnalysisInput = z.infer<typeof RetryAnalysisInputSchema>;


export async function retryAnalysis(input: RetryAnalysisInput): Promise<{ success: boolean; message: string }> {
  return retryAnalysisFlow(input);
}


const retryAnalysisFlow = ai.defineFlow(
  {
    name: 'retryAnalysisFlow',
    inputSchema: RetryAnalysisInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ resultId }) => {
    try {
        console.log(`[Retry Flow] Starting retry for result ID: ${resultId}`);
        const resultRef = doc(db, 'results', resultId);
        const resultSnap = await getDoc(resultRef);

        if (!resultSnap.exists()) {
            throw new Error(`Result document with ID ${resultId} not found.`);
        }

        const resultData = resultSnap.data() as StudentResult;

        if (resultData.status !== '오류') {
            return { success: false, message: 'This result is not in an error state.' };
        }
        if (!resultData.studentRecordingUrl) {
            throw new Error('Recording URL is missing, cannot retry analysis.');
        }

        const assessmentRef = doc(db, 'assessments', resultData.assessmentId);
        const assessmentSnap = await getDoc(assessmentRef);
        if (!assessmentSnap.exists()) {
            throw new Error(`Parent assessment with ID ${resultData.assessmentId} not found.`);
        }
        const assessmentData = assessmentSnap.data() as TeacherAssessment;

        // Reset status to show it's processing again
        await updateDoc(resultRef, { status: "분석 중" });
        
        // Determine which analysis flow to call based on assessment type
        if (assessmentData.assessmentType === 'dialogue') {
            // Dialogue flow is more complex and expects a full input object.
            // Note: The full conversation transcript is not saved on error.
            // We will have to pass what we have. This is a limitation.
            const studentTranscript = resultData.studentTranscript || "";
            const fullTranscript = studentTranscript ? `학생: ${studentTranscript}` : "대화 기록을 복구할 수 없습니다.";

             await generateDialogueAnalysis({
                resultId: resultId,
                teacherUid: resultData.teacherUid,
                studentRecordingUrl: resultData.studentRecordingUrl,
                studentTranscript: studentTranscript,
                fullConversationTranscript: fullTranscript,
                activityPrompt: assessmentData.prompt,
                expectedFormat: assessmentData.expectedFormat || "",
                studentName: resultData.name,
                assessmentTitle: assessmentData.title,
                evaluationModel: assessmentData.evaluationModel,
                useRubric: assessmentData.useRubric || false,
             });

        } else {
            // Monologue flow can be called directly with the necessary info.
            // Note: Monologue flow takes a data URI, but we have a URL.
            // The flow needs to be able to handle both or we need to fetch the data.
            // For now, we assume the monologue flow was designed to handle a URL.
            // Let's call the *exported* function, not the flow itself.
            // This is incorrect. The monologue flow takes a dataURI.
            // This will fail. We need to refactor the monologue flow.
            // For now, let's just log an error for monologue.
            // TODO: Refactor monologue flow to accept a URL or fetch the data.
             throw new Error('Monologue retry is not yet implemented due to data format mismatch.');
        }

        console.log(`[Retry Flow] Successfully re-triggered analysis for ${resultId}`);
        return { success: true, message: 'Analysis retry successfully initiated.' };

    } catch (e: any) {
        console.error(`[Retry Flow] An error occurred during retry for ${resultId}:`, e);
        // Set back to error state if retry fails
        await updateDoc(doc(db, 'results', resultId), {
            status: '오류',
            aiFeedback: `재시도 실패: ${(e as Error).message || '알 수 없는 오류'}`,
        });
        throw e;
    }
  }
);
