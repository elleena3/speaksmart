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
import { resultRef, uploadDataUrl } from "@/lib/server-store";
import { gradeWithRubric, describeRubricResult } from "./grade-with-rubric";
import { renderRubricSummary, pickPronunciationScore } from "@/lib/rubric-summary";
import { RubricCriterionSchema } from "@/lib/types/ai-schemas";
import { describeAiError } from "@/lib/ai-error-message";

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
  // 교사가 만든 루브릭 항목. 없으면 루브릭 채점을 하지 않습니다.
  rubricCriteria: z.array(RubricCriterionSchema).optional(),
  rubricName: z.string().optional(),
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
    const resultDocRef = resultRef(input.resultId);
    let downloadURL = "";

    try {
      await resultDocRef.update({ status: "분석 중: upload", assessmentType: "monologue" });
      const uploadPath = `recordings/${input.studentName}_${Date.now()}.webm`;
      const uploadTask = uploadDataUrl(uploadPath, input.studentRecordingDataUri);

      await resultDocRef.update({ status: "분석 중: transcribe" });
      const transcriptionResult = await withRetry(() => monologueTranscriptionPrompt({ studentRecordingUrl: input.studentRecordingDataUri }, { model }));
      const studentTranscript = transcriptionResult.text;

      if (!studentTranscript || studentTranscript.trim() === "") {
          throw new Error('학생 답변을 인식하지 못했습니다.');
      }

      downloadURL = await uploadTask;

      await resultDocRef.update({ status: "분석 중: analyze" });
      
      let finalResult: any;

      // 루브릭 항목이 전달된 경우에만 루브릭 채점을 합니다.
      // useRubric 만 켜져 있고 항목이 없으면 아래 일반 채점으로 넘어갑니다.
      if (input.useRubric && input.rubricCriteria?.length) {
          const graded = await withRetry(() => gradeWithRubric({
              transcript: studentTranscript,
              activityPrompt: input.activityPrompt,
              rubricName: input.rubricName,
              criteria: input.rubricCriteria!,
          }));

          const guidanceResult = await withRetry(() => monologueTeacherGuidanceFromRubricPrompt({
              studentFeedbackHtml: renderRubricSummary(graded),
          }, { model }));

          finalResult = {
              studentTranscript,
              contentScore: graded.percentageScore,
              // 루브릭에 발음 항목이 있으면 그 항목을 발음 점수로 씁니다. 없으면 총점으로 대체합니다.
              pronunciationScore: pickPronunciationScore(graded) ?? graded.percentageScore,
              aiFeedback: renderRubricSummary(graded),
              teacherGuidance: guidanceResult.text,
              curricularRemarks: await describeRubricResult(input.assessmentTitle, graded),
              pronunciationFeedback: graded.evaluation.summary,
              rubricEvaluation: graded.evaluation,
              rubricName: input.rubricName ?? null,
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
      
      await resultDocRef.update({
          ...finalResult,
          studentRecordingUrl: downloadURL,
          status: "채점 완료",
          teacherUid: input.teacherUid,
          assessmentType: "monologue",
      });
    } catch(e) {
       // 크레딧 소진 같은 원인은 원문만 보면 알 수 없어 교사가 조치할 수 없습니다.
       const info = describeAiError(e, model);
       console.error('monologue 분석 실패:', info.kind, info.detail);
       await resultDocRef.update({
          status: '오류',
          aiFeedback: info.message,
          studentRecordingUrl: downloadURL || ""
       });
       throw e;
    }
  }
);