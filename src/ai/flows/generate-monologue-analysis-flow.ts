
'use server';

/**
 * @fileOverview A comprehensive flow that analyzes a student's MONOLOGUE English performance.
 * It orchestrates transcription, content analysis, and pronunciation analysis in an efficient, parallel manner.
 *
 * - generateMonologueAnalysis - The main function to call for a full monologue speaking assessment.
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
 * Main exported function to be called by the client for monologue analysis.
 */
export async function generateMonologueAnalysis(
    input: GenerateMonologueAnalysisInput
): Promise<z.infer<typeof CombinedAnalysisOutputSchema>> {
  return generateMonologueAnalysisFlow(input);
}


// Internal Sub-flows and Prompts

// 1. Transcription Flow
const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: z.string(), // gs:// URI
    outputSchema: z.string(), // transcript
  },
  async (audioGcsUri) => {
    if (!audioGcsUri) {
        return "(학생 답변이 기록되지 않았습니다.)";
    }
    const sttResponse = await ai.generate({
      model: googleAI.model('gemini-2.0-flash'),
      prompt: [
        { text: 'Transcribe this English audio.' },
        { media: { url: audioGcsUri, contentType: 'audio/webm' } },
      ],
    });
    return sttResponse.text || "(학생 답변을 인식하지 못했습니다.)";
  }
);


// 2. Content Analysis Prompt
const contentAnalysisPrompt = ai.definePrompt({
  name: 'monologueContentAnalysisPrompt',
  model: googleAI.model('gemini-2.0-flash'),
  input: { schema: z.object({
    studentTranscript: z.string(),
    activityPrompt: z.string(),
    expectedFormat: z.string(),
    studentName: z.string(),
    assessmentTitle: z.string(),
  }) },
  output: { schema: ContentAnalysisOutputSchema },
  prompt: `You are an AI English Teacher evaluating a student's monologue performance based on a transcript. Your persona is that of an expert English teacher providing constructive feedback for skill improvement. Your entire response must be in the specified JSON format, and all text feedback must be in Korean.

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

// 3. Pronunciation Analysis Prompt
const pronunciationAnalysisPrompt = ai.definePrompt({
    name: 'monologuePronunciationAnalysisPrompt',
    model: googleAI.model('gemini-2.0-flash'),
    input: { schema: z.object({
        studentRecordingGcsUri: z.string(),
        studentTranscript: z.string(),
    }) },
    output: { schema: PronunciationAnalysisOutputSchema },
    prompt: `You are an expert English pronunciation coach. Your task is to evaluate a student's spoken English based on their audio recording and the corresponding transcript. Provide all feedback in Korean.

    - Student's Audio Recording: {{media url=studentRecordingGcsUri contentType='audio/webm'}}
    - AI-generated Transcript: {{{studentTranscript}}}

    Please perform the following steps:
    1.  Listen carefully to the audio and compare it with the transcript.
    2.  Evaluate accuracy, clarity, intonation, and fluency.
    3.  **Assign a Pronunciation Score:** Give a score from 0 to 100 (100 is native-like, 0 is unintelligible).
    4.  **Provide Pronunciation Feedback:** Write specific, constructive feedback in Korean. Point out specific words or sounds that were pronounced well and those that need improvement. If the transcript is empty or indicates no speech, provide a score of 0 and state that no speech was detected.
    `,
});


// 4. The Main Orchestration Flow
const generateMonologueAnalysisFlow = ai.defineFlow(
  {
    name: 'generateMonologueAnalysisFlow',
    inputSchema: GenerateMonologueAnalysisInputSchema,
    outputSchema: CombinedAnalysisOutputSchema,
  },
  async (input) => {
    
    // Step 1: Transcribe the audio.
    const studentTranscript = await transcribeAudioFlow(input.studentRecordingGcsUri);

    if (!studentTranscript || studentTranscript.includes('기록되지 않았습니다') || studentTranscript.includes('인식하지 못했습니다')) {
        return {
            studentTranscript: studentTranscript || '학생 답변을 인식하지 못했습니다.',
            aiFeedback: '학생의 답변을 인식하지 못했습니다. 마이크 상태를 확인하고 다시 시도해주세요.',
            teacherGuidance: '학생의 답변을 인식할 수 없어 조언을 생성할 수 없습니다.',
            curricularRemarks: '학생의 답변이 없어 비고 작성이 불가능합니다.',
            contentScore: 0,
            pronunciationScore: 0,
            pronunciationFeedback: '학생의 음성이 없어 발음 분석을 할 수 없습니다.',
        }
    }
    
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
        studentRecordingGcsUri: input.studentRecordingGcsUri,
        studentTranscript,
      })
    ]);

    const contentOutput = contentResult.output;
    const pronunciationOutput = pronunciationResult.output;

    if (!contentOutput || !pronunciationOutput) {
        throw new Error("Failed to get a valid response from one or more analysis models.");
    }
    
    // Step 3: Combine and return all results to the client.
    return {
        studentTranscript,
        contentScore: contentOutput.contentScore,
        aiFeedback: contentOutput.aiFeedback,
        teacherGuidance: contentOutput.teacherGuidance,
        curricularRemarks: contentOutput.curricularRemarks,
        pronunciationScore: pronunciationOutput.pronunciationScore,
        pronunciationFeedback: pronunciationOutput.pronunciationFeedback,
    };
  }
);

    