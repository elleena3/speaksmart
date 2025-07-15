
'use server';

/**
 * @fileOverview A comprehensive flow that analyzes a student's DIALOGUE English performance.
 * This flow takes pre-processed data (a combined audio file and full transcript) to perform analysis.
 *
 * - generateDialogueAnalysis - The main function to call for a full dialogue speaking assessment.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import {
  GenerateDialogueAnalysisInputSchema,
  ContentAnalysisOutputSchema,
  PronunciationAnalysisOutputSchema,
  CombinedAnalysisOutputSchema,
  type GenerateDialogueAnalysisInput,
} from '@/lib/types/ai-schemas';

/**
 * Main exported function to be called by the client for dialogue analysis.
 */
export async function generateDialogueAnalysis(
    input: GenerateDialogueAnalysisInput
): Promise<z.infer<typeof CombinedAnalysisOutputSchema>> {
  return generateDialogueAnalysisFlow(input);
}

// Internal Sub-prompts

// 1. Content Analysis Prompt for Dialogue
const contentAnalysisPrompt = ai.definePrompt({
  name: 'dialogueContentAnalysisPrompt',
  model: googleAI.model('gemini-2.5-flash'),
  input: { schema: z.object({
    fullConversationTranscript: z.string(),
    activityPrompt: z.string(),
    expectedFormat: z.string(),
    studentName: z.string(),
    assessmentTitle: z.string(),
  }) },
  output: { schema: ContentAnalysisOutputSchema },
  prompt: `You are an AI English Teacher evaluating a student's DIALOGUE performance based on a full conversation transcript. Your persona is that of an expert English teacher providing constructive feedback for skill improvement. Your entire response must be in the specified JSON format, and all text feedback must be in Korean.

Here is the context for the evaluation:
- Student Name: {{{studentName}}}
- Assessment Title: {{{assessmentTitle}}}
- Activity Prompt/Situation: {{{activityPrompt}}}
- Expected Response Format/Grading Criteria: {{{expectedFormat}}}
- Full Conversation Transcript (Student and AI):
{{{fullConversationTranscript}}}

Based on the FULL CONVERSATION, perform the following tasks:
1.  **Generate Feedback for the Student:** Analyze the student's conversational skills (turn-taking, relevance, naturalness) in addition to fluency, grammar, and vocabulary. Provide encouraging and constructive feedback. Include specific examples from the student's parts of the conversation.
2.  **Generate Guidance for the Teacher:** Provide actionable advice for the classroom teacher on how to help this student improve their conversational skills.
3.  **Draft Curricular Remarks:** Write official curricular remarks in a formal, descriptive tone with sentences ending in '~함' or '~임'. The remarks must be based on the student's performance in this specific dialogue, summarizing their interaction and linking it to English communication competencies. Follow a 3-part structure.
4.  **Assign a Content Score:** Give a score from 0 to 100 for the *content and conversational skill* of the student's performance based on how well they navigated the dialogue in line with the prompt and criteria.
`,
});

// 2. Pronunciation Analysis Prompt for Dialogue
const pronunciationAnalysisPrompt = ai.definePrompt({
    name: 'dialoguePronunciationAnalysisPrompt',
    model: googleAI.model('gemini-2.5-flash'),
    input: { schema: z.object({
        studentRecordingUrl: z.string(),
        studentTranscript: z.string(), // Note: This is only the student's part of the transcript
    }) },
    output: { schema: PronunciationAnalysisOutputSchema },
    prompt: `You are an expert English pronunciation coach. Your task is to evaluate a student's spoken English based on their combined audio recording from a conversation and the corresponding transcript of ONLY their speech. Provide all feedback in Korean.

    - Student's Combined Audio Recording: {{media url=studentRecordingUrl}}
    - Transcript of Student's Speech Only: {{{studentTranscript}}}

    Please perform the following steps:
    1.  Listen carefully to the audio and compare it with the student-only transcript.
    2.  Evaluate the student's overall accuracy, clarity, intonation, and fluency throughout the conversation.
    3.  **Assign a Pronunciation Score:** Give a score from 0 to 100 (100 is native-like, 0 is unintelligible).
    4.  **Provide Pronunciation Feedback:** Write specific, constructive feedback in Korean. Point out general patterns or specific words that were pronounced well and those that need improvement. If the transcript is empty or indicates no speech, provide a score of 0 and state that no speech was detected.
    `,
});


// 3. The Main Orchestration Flow for Dialogue
const generateDialogueAnalysisFlow = ai.defineFlow(
  {
    name: 'generateDialogueAnalysisFlow',
    inputSchema: GenerateDialogueAnalysisInputSchema,
    outputSchema: CombinedAnalysisOutputSchema,
  },
  async (input) => {
    
    // In this flow, transcription is already done. We receive the transcript and audio URL.
    if (!input.studentTranscript || !input.fullConversationTranscript) {
        return {
            studentTranscript: input.fullConversationTranscript || '전체 대화 기록이 없습니다.',
            aiFeedback: '학생의 답변이 없어 분석을 진행할 수 없습니다.',
            teacherGuidance: '학생의 답변이 없어 조언을 생성할 수 없습니다.',
            curricularRemarks: '학생의 답변이 없어 비고 작성이 불가능합니다.',
            contentScore: 0,
            pronunciationScore: 0,
            pronunciationFeedback: '학생의 음성이 없어 발음 분석을 할 수 없습니다.',
        }
    }
    
    // Step 1: Run content and pronunciation analysis in PARALLEL.
    const [contentResult, pronunciationResult] = await Promise.all([
      contentAnalysisPrompt({
        fullConversationTranscript: input.fullConversationTranscript,
        activityPrompt: input.activityPrompt,
        expectedFormat: input.expectedFormat,
        studentName: input.studentName,
        assessmentTitle: input.assessmentTitle,
      }),
      pronunciationAnalysisPrompt({
        studentRecordingUrl: input.studentRecordingUrl,
        studentTranscript: input.studentTranscript, // Use student-only transcript for pronunciation
      })
    ]);

    const contentOutput = contentResult.output;
    const pronunciationOutput = pronunciationResult.output;

    if (!contentOutput || !pronunciationOutput) {
        throw new Error("Failed to get a valid response from one or more analysis models.");
    }
    
    // Step 2: Combine and return all results to the client.
    return {
        // Return the full conversation transcript for display purposes
        studentTranscript: input.fullConversationTranscript, 
        contentScore: contentOutput.contentScore,
        aiFeedback: contentOutput.aiFeedback,
        teacherGuidance: contentOutput.teacherGuidance,
        curricularRemarks: contentOutput.curricularRemarks,
        pronunciationScore: pronunciationOutput.pronunciationScore,
        pronunciationFeedback: pronunciationOutput.pronunciationFeedback,
    };
  }
);
