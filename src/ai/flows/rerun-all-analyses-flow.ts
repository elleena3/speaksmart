

'use server';
/**
 * @fileOverview A flow to re-run analysis for all submissions of a given assessment.
 * This is useful when evaluation criteria have been updated.
 *
 * - rerunAllAnalyses - A function that takes an assessment ID and re-triggers analysis for all submissions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { resultRef, assessmentRef, resultsByAssessment, downloadBytes } from '@/lib/server-store';
import { generateMonologueAnalysisFlow } from './generate-monologue-analysis-flow';
import { generateDialogueAnalysis } from './generate-dialogue-analysis-flow';
import { loadRubricById } from './load-rubric-flow';
import { type TeacherAssessment, type StudentResult } from '@/lib/types';
import { RetryAnalysisInputSchema } from '@/lib/types/ai-schemas';

const RerunAllInputSchema = z.object({
  assessmentId: z.string().describe('The Firestore document ID of the assessment to re-evaluate.'),
});
type RerunAllInput = z.infer<typeof RerunAllInputSchema>;

export async function rerunAllAnalyses(input: RerunAllInput): Promise<{ success: boolean; message: string }> {
  return rerunAllAnalysesFlow(input);
}

const rerunAllAnalysesFlow = ai.defineFlow(
  {
    name: 'rerunAllAnalysesFlow',
    inputSchema: RerunAllInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ assessmentId }) => {
    try {
        console.log(`[Rerun Flow] Starting re-evaluation for assessment ID: ${assessmentId}`);
        const assessmentSnap = await assessmentRef(assessmentId).get();

        if (!assessmentSnap.exists) {
            throw new Error(`Assessment document with ID ${assessmentId} not found.`);
        }
        const assessmentData = { id: assessmentSnap.id, ...assessmentSnap.data()} as TeacherAssessment;

        // 루브릭은 제출물마다 다시 읽을 필요가 없어 한 번만 불러옵니다.
        const rubric = assessmentData.useRubric && assessmentData.loadedRubricId
            ? await loadRubricById(assessmentData.loadedRubricId)
            : null;

        const resultsSnapshot = await resultsByAssessment(assessmentId);

        const submissions = resultsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as StudentResult))
            .filter(result => result.studentRecordingUrl); // Only re-run those with a recording
            
        if (submissions.length === 0) {
            return { success: true, message: "재평가할 제출물이 없습니다."};
        }

        console.log(`[Rerun Flow] Found ${submissions.length} submissions to re-evaluate.`);

        const analysisPromises = submissions.map(async (resultData, index) => {
            try {
                // Update status to show it's processing again
                await resultRef(resultData.id).update({ status: "분석 중", aiFeedback: '재평가 중...' });
                console.log(`[Rerun Flow] (${index + 1}/${submissions.length}) Re-evaluating for student ${resultData.name} (Result ID: ${resultData.id})`);

                if (assessmentData.assessmentType === 'dialogue') {
                    await generateDialogueAnalysis({
                        resultId: resultData.id,
                        teacherUid: resultData.teacherUid,
                        studentRecordingUrl: resultData.studentRecordingUrl!,
                        studentTranscript: resultData.studentTranscript || "",
                        fullConversationTranscript: resultData.studentTranscript || "대화 기록을 복구할 수 없습니다.",
                        activityPrompt: assessmentData.prompt,
                        expectedFormat: assessmentData.expectedFormat || "",
                        studentName: resultData.name,
                        assessmentTitle: assessmentData.title,
                        evaluationModel: assessmentData.evaluationModel,
                        useRubric: assessmentData.useRubric || false,
                        rubricCriteria: rubric?.criteria,
                        rubricName: rubric?.name,
                    });
                } else { // Handle Monologue
                    const audioBuffer = await downloadBytes(resultData.studentRecordingUrl!);
                    const mimeType = 'audio/webm;codecs=opus';
                    const studentRecordingDataUri = `data:${mimeType};base64,${audioBuffer.toString('base64')}`;

                    await generateMonologueAnalysisFlow({
                        resultId: resultData.id,
                        studentRecordingDataUri: studentRecordingDataUri,
                        activityPrompt: assessmentData.prompt,
                        expectedFormat: assessmentData.expectedFormat || "",
                        studentName: resultData.name,
                        assessmentTitle: assessmentData.title,
                        evaluationModel: assessmentData.evaluationModel,
                        useRubric: assessmentData.useRubric || false,
                        rubricCriteria: rubric?.criteria,
                        rubricName: rubric?.name,
                        teacherUid: resultData.teacherUid,
                    });
                }
                console.log(`[Rerun Flow] (${index + 1}/${submissions.length}) Successfully re-triggered analysis for ${resultData.id}`);
            } catch (e) {
                 console.error(`[Rerun Flow] Failed to re-evaluate for Result ID ${resultData.id}:`, e);
                 // Set back to error state if individual retry fails
                 await resultRef(resultData.id).update({
                    status: '오류',
                    aiFeedback: `재평가 실패: ${(e as Error).message || '알 수 없는 오류'}`,
                });
            }
        });
        
        await Promise.all(analysisPromises);
        
        console.log(`[Rerun Flow] All re-evaluations for assessment ${assessmentId} have been triggered.`);
        return { success: true, message: `${submissions.length}개의 제출물에 대한 재평가를 성공적으로 시작했습니다. 결과는 잠시 후 업데이트됩니다.` };

    } catch (e: any) {
        console.error(`[Rerun Flow] A critical error occurred during setup for assessment ${assessmentId}:`, e);
        throw e;
    }
  }
);
