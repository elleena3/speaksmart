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
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error.message && (error.message.includes('overloaded') || error.message.includes('503'))) {
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
  const resultDocRef = doc(db, "results", input.resultId);
  let model = input.evaluationModel || 'googleai/gemini-3.5-flash';
  if (model.includes('1.5') || model.includes('2.5')) {
      model = model.includes('pro') ? 'googleai/gemini-3.1-pro-preview' : 'googleai/gemini-3.5-flash';
  } else if (!model.includes('/')) {
      model = 'googleai/' + model;
  }

  try {
      let finalResult: any;

      if (input.useRubric) {
          const rubricResult = await withRetry(() => dialogueRubricAnalysisPrompt({ fullConversationTranscript: input.fullConversationTranscript }, { model }));
          let rubricText = rubricResult.text;
          if (rubricText.startsWith("```html")) rubricText = rubricText.substring(7, rubricText.length - 3).trim();
          
          const rubricScores: RubricScores = {
              fluency: parseScore(rubricText, '유창성'),
              pronunciation: parseScore(rubricText, '발음 및 억양'),
              grammar: parseScore(rubricText, '문법'),
              vocabulary: parseScore(rubricText, '어휘'),
              interaction: parseScore(rubricText, '내용 이해 및 상호작용'),
          };

          const contentScore = Math.round(((rubricScores.fluency + rubricScores.grammar + rubricScores.vocabulary + (rubricScores.interaction || 0)) / 4) * 20);
          const pronunciationScore = rubricScores.pronunciation * 20;
          const guidanceRes = await withRetry(() => dialogueTeacherGuidanceFromRubricPrompt({ studentFeedbackHtml: rubricText }, { model }));

          finalResult = {
              studentTranscript: input.fullConversationTranscript,
              contentScore,
              pronunciationScore,
              aiFeedback: rubricText,
              teacherGuidance: guidanceRes.text,
              curricularRemarks: `대화 평가 결과 종합 ${contentScore}점 성취함.`,
              pronunciationFeedback: `리포트 참고.`,
              rubricScores,
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
            withRetry(() => dialoguePronunciationAnalysisPrompt({
              studentRecordingUrl: input.studentRecordingUrl,
              studentTranscript: input.studentTranscript,
            }, { model }))
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
      
      await updateDoc(resultDocRef, {
          ...finalResult,
          status: "채점 완료",
          teacherUid: input.teacherUid,
          studentRecordingUrl: input.studentRecordingUrl,
          assessmentType: "dialogue",
      });
  } catch (e: any) {
      await updateDoc(resultDocRef, {
          status: "오류",
          aiFeedback: e.message,
          studentRecordingUrl: input.studentRecordingUrl,
          assessmentType: "dialogue",
      });
      throw e;
  }
}