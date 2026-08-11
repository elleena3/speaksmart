'use server';

/**
 * @fileOverview A comprehensive flow that analyzes a student's DIALOGUE English performance.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  GenerateDialogueAnalysisInputSchema,
  ContentAnalysisOutputSchema,
  PronunciationAnalysisOutputSchema,
  CombinedAnalysisOutputSchema,
} from '@/lib/types/ai-schemas';
import { type RubricScores, type StudentResult } from '@/lib/types';
import { resultRef } from '@/lib/server-store';
import { gradeWithRubric, describeRubricResult } from './grade-with-rubric';
import { isRetriableAiError, withAudioFallback } from '@/lib/ai-retry';
import { renderRubricSummary, pickPronunciationScore } from '@/lib/rubric-summary';
import { describeAiError } from '@/lib/ai-error-message';

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (isRetriableAiError(error)) {
        console.warn(`[withRetry] Attempt ${i + 1} failed. Retrying...`);
        if (i < retries) await new Promise(resolve => setTimeout(resolve, delay));
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

const dialogueContentAnalysisPrompt = ai.definePrompt({
    name: 'dialogueContentAnalysisPrompt',
    input: { schema: z.object({
        fullConversationTranscript: z.string(),
        activityPrompt: z.string(),
        expectedFormat: z.string(),
        studentName: z.string(),
        assessmentTitle: z.string(),
    }) },
    output: { schema: ContentAnalysisOutputSchema },
    prompt: `Analyze student dialogue for: {{{studentName}}}.
Full Transcript:
{{{fullConversationTranscript}}}
Criteria: {{{expectedFormat}}}`,
});

const dialoguePronunciationAnalysisPrompt = ai.definePrompt({
    name: 'dialoguePronunciationAnalysisPrompt',
    input: { schema: z.object({
        studentRecordingUrl: z.string(),
        studentTranscript: z.string(),
    }) },
    output: { schema: PronunciationAnalysisOutputSchema },
    prompt: `Evaluate pronunciation.
Recording: {{media url=studentRecordingUrl}}
Transcript: {{{studentTranscript}}}`,
});

const dialogueRubricAnalysisPrompt = ai.definePrompt({
    name: 'dialogueRubricAnalysisPrompt',
    input: { schema: z.object({ fullConversationTranscript: z.string() }) },
    prompt: `Generate HTML report based on rubric for:
{{{fullConversationTranscript}}}`,
});

const dialogueTeacherGuidanceFromRubricPrompt = ai.definePrompt({
    name: 'dialogueTeacherGuidanceFromRubricPrompt',
    input: { schema: z.object({ studentFeedbackHtml: z.string() }) },
    prompt: `Provide guidance in Korean based on report:
{{{studentFeedbackHtml}}}`,
});

// --- Main Function ---

export async function generateDialogueAnalysis(input: any): Promise<void> {
  const resultDocRef = resultRef(input.resultId);
  let model = input.evaluationModel || 'googleai/gemini-3.6-flash';
  if (model.includes('1.5') || model.includes('2.5')) {
      model = model.includes('pro') ? 'googleai/gemini-3.1-pro-preview' : 'googleai/gemini-3.6-flash';
  } else if (!model.includes('/')) {
      model = 'googleai/' + model;
  }

  try {
      let finalResult: any;

      // 루브릭 항목이 전달된 경우에만 루브릭 채점을 합니다.
      if (input.useRubric && input.rubricCriteria?.length) {
          const graded = await withRetry(() => gradeWithRubric({
              transcript: input.fullConversationTranscript,
              activityPrompt: input.activityPrompt,
              rubricName: input.rubricName,
              criteria: input.rubricCriteria,
          }));

          const guidanceRes = await withRetry(() => dialogueTeacherGuidanceFromRubricPrompt({
              studentFeedbackHtml: renderRubricSummary(graded),
          }, { model }));

          finalResult = {
              studentTranscript: input.fullConversationTranscript,
              contentScore: graded.percentageScore,
              pronunciationScore: pickPronunciationScore(graded) ?? graded.percentageScore,
              aiFeedback: renderRubricSummary(graded),
              teacherGuidance: guidanceRes.text,
              curricularRemarks: await describeRubricResult(input.assessmentTitle ?? '대화 평가', graded),
              pronunciationFeedback: graded.evaluation.summary,
              rubricEvaluation: graded.evaluation,
              rubricName: input.rubricName ?? null,
          };
      } else {
          const [contentRes, pronRes] = await Promise.all([
            withRetry(() => dialogueContentAnalysisPrompt({
              fullConversationTranscript: input.fullConversationTranscript,
              activityPrompt: input.activityPrompt,
              expectedFormat: input.expectedFormat,
              studentName: input.studentName,
              assessmentTitle: input.assessmentTitle,
            }, { model })),
            // 발음 분석은 녹음을 그대로 넘기므로 오디오 대체 규칙을 씁니다.
            withAudioFallback(model, (m) => withRetry(() => dialoguePronunciationAnalysisPrompt({
              studentRecordingUrl: input.studentRecordingUrl,
              studentTranscript: input.studentTranscript,
            }, { model: m })), '발음 분석')
          ]);

          if (!contentRes.output || !pronRes.output) throw new Error("분석 실패.");

          finalResult = {
              studentTranscript: input.fullConversationTranscript,
              contentScore: contentRes.output.contentScore,
              aiFeedback: contentRes.output.aiFeedback,
              teacherGuidance: contentRes.output.teacherGuidance,
              curricularRemarks: contentRes.output.curricularRemarks,
              pronunciationScore: pronRes.output.pronunciationScore,
              pronunciationFeedback: pronRes.output.pronunciationFeedback,
          };
      }
      
      await resultDocRef.update({
          ...finalResult,
          status: "채점 완료",
          teacherUid: input.teacherUid,
          studentRecordingUrl: input.studentRecordingUrl,
          assessmentType: "dialogue",
      });
  } catch (e: any) {
      // 크레딧 소진 같은 원인은 원문만 보면 알 수 없어 교사가 조치할 수 없습니다.
      const info = describeAiError(e, model);
      console.error('dialogue 분석 실패:', info.kind, info.detail);
      await resultDocRef.update({
          status: "오류",
          aiFeedback: info.message,
          studentRecordingUrl: input.studentRecordingUrl,
          assessmentType: "dialogue",
      });
      throw e;
  }
}