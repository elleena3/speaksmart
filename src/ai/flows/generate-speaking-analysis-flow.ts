
'use server';

/**
 * @fileOverview A comprehensive flow that analyzes a student's spoken English performance.
 * It orchestrates transcription, content analysis, and pronunciation analysis in an efficient, parallel manner.
 *
 * - generateSpeakingAnalysis - The main function to call for a full speaking assessment.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { db as adminDb } from '@/lib/firebase-admin'; // Use Admin SDK for server-side operations
import {
  GenerateSpeakingAnalysisInputSchema,
  ContentAnalysisInputSchema,
  ContentAnalysisOutputSchema,
  PronunciationAnalysisInputSchema,
  PronunciationAnalysisOutputSchema,
  type GenerateSpeakingAnalysisInput,
} from '@/lib/types/ai-schemas';
import { type StudentResult } from '@/lib/types';


/**
 * Main exported function to be called by the client.
 * It orchestrates the entire analysis process.
 */
export async function generateSpeakingAnalysis(
    input: GenerateSpeakingAnalysisInput
): Promise<{ resultId: string }> { // Returns the ID of the created result document
  return generateSpeakingAnalysisFlow(input);
}


// 2. Internal Sub-flows and Prompts

// 2a. Transcription Flow
const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: z.string(), // data URI
    outputSchema: z.string(), // transcript
  },
  async (audioDataUri) => {
    // A simple check for empty or invalid data URI
    if (!audioDataUri || !audioDataUri.includes(',')) {
        return "(학생 답변이 기록되지 않았습니다.)";
    }
    const sttResponse = await ai.generate({
      model: googleAI.model('gemini-2.0-flash'),
      prompt: [
        { text: 'Transcribe this English audio.' },
        { media: { url: audioDataUri } },
      ],
    });
    return sttResponse.text || "(학생 답변을 인식하지 못했습니다.)";
  }
);


// 2b. Content Analysis Prompt
const contentAnalysisPrompt = ai.definePrompt({
  name: 'contentAnalysisPrompt',
  input: { schema: ContentAnalysisInputSchema },
  output: { schema: ContentAnalysisOutputSchema },
  prompt: `You are an AI English Teacher evaluating a student's performance based on a transcript. Your persona is that of an expert English teacher providing constructive feedback for skill improvement. Your entire response must be in the specified JSON format, and all text feedback must be in Korean.

Here is the context for the evaluation:
- Student Name: {{{studentName}}}
- Assessment Title: {{{assessmentTitle}}}
- Activity Prompt: {{{activityPrompt}}}
- Expected Response Format/Grading Criteria: {{{expectedFormat}}}
- Student's Spoken Response (Transcript): {{{studentTranscript}}}

Based on all the information provided, perform the following tasks:
1.  **Generate Feedback for the Student:** Write encouraging and constructive feedback focusing on what they did well and what they can improve regarding fluency, grammar, and vocabulary in relation to the prompt. Include specific examples from their transcript. Suggest alternative English vocabulary or sentence structures.
2.  **Generate Guidance for the Teacher:** Provide actionable advice for the classroom teacher on how to help this student. Suggest specific English teaching activities or focus areas.
3.  **Draft Curricular Remarks:** Write official curricular remarks in a formal, descriptive tone with sentences ending in '~함' or '~임'. The remarks must be based on the student's performance in this specific task, summarizing their performance and linking it to English competencies. Follow a 3-part structure: ① General participation, ② Specific examples from their speech, ③ Collaboration/other character traits.
4.  **Assign a Content Score:** Give a score from 0 to 100 for the *content* of the response based on how well it aligns with the prompt and criteria.
`,
});

// 2c. Pronunciation Analysis Prompt
const pronunciationAnalysisPrompt = ai.definePrompt({
    name: 'pronunciationAnalysisPrompt',
    input: { schema: PronunciationAnalysisInputSchema },
    output: { schema: PronunciationAnalysisOutputSchema },
    prompt: `You are an expert English pronunciation coach. Your task is to evaluate a student's spoken English based on their audio recording and the corresponding transcript. Provide all feedback in Korean.

    - Student's Audio Recording: {{media url=studentRecordingDataUri}}
    - AI-generated Transcript: {{{studentTranscript}}}

    Please perform the following steps:
    1.  Listen carefully to the audio and compare it with the transcript.
    2.  Evaluate accuracy, clarity, intonation, and fluency.
    3.  **Assign a Pronunciation Score:** Give a score from 0 to 100 (100 is native-like, 0 is unintelligible).
    4.  **Provide Pronunciation Feedback:** Write specific, constructive feedback in Korean. Point out specific words or sounds that were pronounced well and those that need improvement. If the transcript is empty or indicates no speech, provide a score of 0 and state that no speech was detected.
    `,
});


// 3. The Main Orchestration Flow
const generateSpeakingAnalysisFlow = ai.defineFlow(
  {
    name: 'generateSpeakingAnalysisFlow',
    inputSchema: GenerateSpeakingAnalysisInputSchema,
    outputSchema: z.object({ resultId: z.string() }),
  },
  async (input) => {
    
    // Create a new result document in Firestore with 'in-progress' status
    const resultsCollectionRef = adminDb.collection("results");
    const newResultRef = resultsCollectionRef.doc();
    
    // This function will be called to update the document's status
    const updateResultStatus = async (status: string, progress: number) => {
        await newResultRef.update({ status, progress });
    };

    try {
        await newResultRef.set({
            studentId: input.studentId,
            assessmentId: input.assessmentId,
            assessmentTitle: input.assessmentTitle,
            teacherUid: input.teacherUid,
            name: input.studentName,
            avatarUrl: input.avatarUrl,
            createdAt: Date.now(),
            date: new Date().toISOString(),
            status: "텍스트 변환 중",
            progress: 10,
        });
        
        // Step 1: Transcribe the audio.
        const studentTranscript = await transcribeAudioFlow(input.studentRecordingDataUri);
        await newResultRef.update({ studentTranscript });

        if (!studentTranscript || studentTranscript.includes('기록되지 않았습니다') || studentTranscript.includes('인식하지 못했습니다')) {
            await newResultRef.update({
                aiFeedback: '학생의 답변을 인식하지 못했습니다. 마이크 상태를 확인하고 다시 시도해주세요.',
                teacherGuidance: '학생의 답변을 인식할 수 없어 조언을 생성할 수 없습니다.',
                curricularRemarks: '학생의 답변이 없어 비고 작성이 불가능합니다.',
                score: 0,
                contentScore: 0,
                pronunciationScore: 0,
                pronunciationFeedback: '학생의 음성이 없어 발음 분석을 할 수 없습니다.',
                status: '오류',
                progress: 100,
            });
            return { resultId: newResultRef.id };
        }
        
        await updateResultStatus("분석 중", 50);

        // Step 2: Run content and pronunciation analysis in PARALLEL.
        const [contentResult, pronunciationResult] = await Promise.all([
          contentAnalysisPrompt({
            studentTranscript,
            activityPrompt: input.activityPrompt,
            expectedFormat: input.expectedFormat,
            studentName: input.studentName,
            assessmentTitle: input.assessmentTitle,
          }),
          pronunciationAnalysisPrompt({
            studentRecordingDataUri: input.studentRecordingDataUri,
            studentTranscript,
          })
        ]);

        const contentOutput = contentResult.output;
        const pronunciationOutput = pronunciationResult.output;

        if (!contentOutput || !pronunciationOutput) {
            throw new Error("Failed to get a valid response from one or more analysis models.");
        }
        
        await updateResultStatus("리포트 생성 중", 90);

        // Step 3: Combine results and update the final document
        const finalResultData: Partial<StudentResult> = {
            aiFeedback: contentOutput.aiFeedback,
            teacherGuidance: contentOutput.teacherGuidance,
            curricularRemarks: contentOutput.curricularRemarks,
            score: contentOutput.contentScore, // Use score field
            contentScore: contentOutput.contentScore,
            pronunciationScore: pronunciationOutput.pronunciationScore,
            pronunciationFeedback: pronunciationOutput.pronunciationFeedback,
            studentFeedbackSummary: "학생이 평가에 대해 남긴 피드백이 없습니다.",
            studentRecordingDataUri: input.studentRecordingDataUri, // For now, save data URI.
            status: '채점 완료',
            progress: 100
        };

        await newResultRef.update(finalResultData);

        // Step 4: Update the assessment's average score and submission count in a transaction
        const assessmentRef = adminDb.collection("assessments").doc(input.assessmentId);
        await adminDb.runTransaction(async (transaction) => {
            const assessmentDoc = await transaction.get(assessmentRef);
            if (!assessmentDoc.exists) return;
            const data = assessmentDoc.data()!;
            const newSubmissionCount = (data.submissionCount || 0) + 1;
            const currentTotalScore = (data.averageScore || 0) * (data.submissionCount || 0);
            const newAverage = (currentTotalScore + (contentOutput.contentScore || 0)) / newSubmissionCount;
            transaction.update(assessmentRef, {
                submissionCount: newSubmissionCount,
                averageScore: Math.round(newAverage)
            });
        });

        return { resultId: newResultRef.id };

    } catch(error) {
        console.error("Error in generateSpeakingAnalysisFlow:", error);
        // Update the document to show an error state
        await newResultRef.update({
            status: '오류',
            progress: 100,
            aiFeedback: `AI 분석 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        // Re-throw the error to be caught by the client-side caller
        throw error;
    }
  }
);
