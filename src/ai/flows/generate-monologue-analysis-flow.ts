'use server';

/**
 * @fileOverview A comprehensive flow that analyzes a student's MONOLOGUE English performance.
 * It orchestrates transcription, content analysis, and pronunciation analysis in an efficient, parallel manner.
 *
 * - generateMonologueAnalysisFlow - The main flow to call for a full monologue speaking assessment.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  ContentAnalysisOutputSchema,
  PronunciationAnalysisOutputSchema,
  CombinedAnalysisOutputSchema,
} from '@/lib/types/ai-schemas';
import { evaluationModels, type RubricScores, type StudentResult } from '@/lib/types';
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc } from 'firebase/firestore';

// Helper function for retrying API calls on overload
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error.message && (error.message.includes('overloaded') || error.message.includes('503'))) {
        console.warn(`[withRetry] Attempt ${i + 1} failed due to model overload. Retrying in ${delay}ms...`);
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

const parseScore = (text: string, category: string): number => {
    const regex = new RegExp(`${category}[\\s\\S]*?점수[^\\d]*(\\d)`);
    const match = text.match(regex);
    return match ? parseInt(match[1], 10) : 0;
};

// --- Top-level Prompt Definitions ---

const monologueTranscriptionPrompt = ai.definePrompt({
    name: 'monologueTranscriptionPrompt',
    prompt: `Transcribe this English audio. If the audio is silent or contains no discernible speech, return an empty string. Do not correct any grammatical errors or mispronunciations. Transcribe exactly what is heard.
Audio: {{media url=studentRecordingUrl}}`,
});

const monologueContentAnalysisPrompt = ai.definePrompt({
    name: 'monologueContentAnalysisPrompt',
    input: { schema: z.object({
        studentTranscript: z.string(),
        activityPrompt: z.string(),
        expectedFormat: z.string(),
        studentName: z.string(),
        assessmentTitle: z.string(),
    }) },
    output: { schema: ContentAnalysisOutputSchema },
    prompt: `You are an expert English teacher. Provide feedback in Korean for student: {{{studentName}}}.
Assessment: {{{assessmentTitle}}}
Prompt: {{{activityPrompt}}}
Criteria: {{{expectedFormat}}}
Transcript: {{{studentTranscript}}}

Tasks:
1. Generate encouraging Markdown feedback ('aiFeedback').
2. Provide teacher guidance ('teacherGuidance').
3. Draft official school record remarks ('curricularRemarks') ending in '~함' or '~임'.
4. Assign a content score (0-100).`,
});

const monologuePronunciationAnalysisPrompt = ai.definePrompt({
    name: 'monologuePronunciationAnalysisPrompt',
    input: { schema: z.object({
        studentRecordingUrl: z.string(),
        studentTranscript: z.string(),
    }) },
    output: { schema: PronunciationAnalysisOutputSchema },
    prompt: `Evaluate pronunciation in Korean.
Recording: {{media url=studentRecordingUrl}}
Transcript: {{{studentTranscript}}}

Assign a score (0-100) and specific feedback.`,
});

const monologueRubricAnalysisPrompt = ai.definePrompt({
    name: 'monologueRubricAnalysisPrompt',
    input: { schema: z.object({ studentTranscript: z.string() }) },
    prompt: `Generate a complete HTML report based on the rubric for this transcript:
{{{studentTranscript}}}

Rubric Categories: Fluency, Pronunciation, Grammar, Vocabulary. (Interaction is N/A for monologue).
Output ONLY the HTML starting with <!DOCTYPE html>.`,
});

const monologueTeacherGuidanceFromRubricPrompt = ai.definePrompt({
    name: 'monologueTeacherGuidanceFromRubricPrompt',
    input: { schema: z.object({ studentFeedbackHtml: z.string() }) },
    prompt: `Based on this HTML report, provide actionable teacher guidance in Korean:
{{{studentFeedbackHtml}}}`,
});

// --- Main Flow ---

const MonologueProcessingInputSchema = z.object({
  studentRecordingDataUri: z.string(),
  activityPrompt: z.string(),
  expectedFormat: z.string(),
  studentName: z.string(),
  assessmentTitle: z.string(),
  evaluationModel: z.string().optional(),
  useRubric: z.boolean().optional(),
  resultId: z.string(),
  teacherUid: z.string(),
});

export const generateMonologueAnalysisFlow = ai.defineFlow(
  {
    name: 'generateMonologueAnalysisFlow',
    inputSchema: MonologueProcessingInputSchema,
  },
  async (input) => {
    let model = input.evaluationModel || 'googleai/gemini-3.6-flash';
  if (model.includes('1.5') || model.includes('2.5')) {
      model = model.includes('pro') ? 'googleai/gemini-3.1-pro-preview' : 'googleai/gemini-3.6-flash';
  } else if (!model.includes('/')) {
      model = 'googleai/' + model;
  }
    const resultDocRef = doc(db, "results", input.resultId);
    let downloadURL = "";

    try {
      await updateDoc(resultDocRef, { status: "분석 중: upload", assessmentType: "monologue" });
      const uploadPath = `recordings/${input.studentName}_${Date.now()}.webm`;
      const storageRef = ref(storage, uploadPath);
      const uploadTask = uploadString(storageRef, input.studentRecordingDataUri, 'data_url');
      
      await updateDoc(resultDocRef, { status: "분석 중: transcribe" });
      const transcriptionResult = await withRetry(() => monologueTranscriptionPrompt({ studentRecordingUrl: input.studentRecordingDataUri }, { model }));
      const studentTranscript = transcriptionResult.text;

      if (!studentTranscript || studentTranscript.trim() === "") {
          throw new Error('학생 답변을 인식하지 못했습니다.');
      }
      
      const uploadSnapshot = await uploadTask;
      downloadURL = await getDownloadURL(uploadSnapshot.ref);

      await updateDoc(resultDocRef, { status: "분석 중: analyze" });
      
      let finalResult: any;

      if (input.useRubric) {
          const rubricResult = await withRetry(() => monologueRubricAnalysisPrompt({ studentTranscript }, { model }));
          let rubricText = rubricResult.text;
          if (rubricText.startsWith("```html")) rubricText = rubricText.substring(7, rubricText.length - 3).trim();
          
          const rubricScores: RubricScores = {
            fluency: parseScore(rubricText, '유창성'),
            pronunciation: parseScore(rubricText, '발음 및 억양'),
            grammar: parseScore(rubricText, '문법'),
            vocabulary: parseScore(rubricText, '어휘'),
            interaction: 1, 
          };
          
          const contentScore = Math.round(((rubricScores.fluency + rubricScores.grammar + rubricScores.vocabulary) / 3) * 20);
          const pronunciationScore = rubricScores.pronunciation * 20;
          const guidanceResult = await withRetry(() => monologueTeacherGuidanceFromRubricPrompt({ studentFeedbackHtml: rubricText }, { model }));

          finalResult = {
              studentTranscript,
              contentScore,
              pronunciationScore,
              aiFeedback: rubricText,
              teacherGuidance: guidanceResult.text,
              curricularRemarks: `'${input.assessmentTitle}' 루브릭 평가 종합 ${contentScore}점, 발음 ${pronunciationScore}점 성취함.`,
              pronunciationFeedback: `상세 분석 리포트 참고.`,
              rubricScores,
          };
      } else {
          const [contentRes, pronRes] = await Promise.all([
              withRetry(() => monologueContentAnalysisPrompt({
                  studentTranscript,
                  activityPrompt: input.activityPrompt,
                  expectedFormat: input.expectedFormat,
                  studentName: input.studentName,
                  assessmentTitle: input.assessmentTitle,
              }, { model })),
              withRetry(() => monologuePronunciationAnalysisPrompt({
                  studentRecordingUrl: input.studentRecordingDataUri,
                  studentTranscript,
              }, { model }))
          ]);
          
          const contentOutput = contentRes.output;
          const pronOutput = pronRes.output;
          
          if (!contentOutput || !pronOutput) throw new Error("분석 모델 응답 실패.");

          finalResult = {
              studentTranscript,
              contentScore: contentOutput.contentScore,
              aiFeedback: contentOutput.aiFeedback,
              teacherGuidance: contentOutput.teacherGuidance,
              curricularRemarks: contentOutput.curricularRemarks,
              pronunciationScore: pronOutput.pronunciationScore,
              pronunciationFeedback: pronOutput.pronunciationFeedback,
          };
      }
      
      await updateDoc(resultDocRef, {
          ...finalResult,
          studentRecordingUrl: downloadURL,
          status: "채점 완료",
          teacherUid: input.teacherUid,
          assessmentType: "monologue",
      });
    } catch(e) {
       await updateDoc(resultDocRef, { 
          status: '오류', 
          aiFeedback: (e as Error).message,
          studentRecordingUrl: downloadURL || ""
       });
       throw e;
    }
  }
);