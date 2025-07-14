
'use server';

/**
 * @fileOverview Generates comprehensive feedback for a monologue speaking assessment.
 * It transcribes student audio, then generates student feedback, teacher guidance, curricular remarks, and a score.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

// Input schema for the entire comprehensive feedback generation flow
const GenerateComprehensiveFeedbackInputSchema = z.object({
  studentRecordingDataUri: z.string().describe(
    "The student's voice recording as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
  ),
  activityPrompt: z.string().describe('The prompt or instructions for the speaking activity.'),
  expectedFormat: z.string().describe('The expected format or key points of the response for grading.'),
  studentName: z.string().describe('The name of the student.'),
  assessmentTitle: z.string().describe('The title of the assessment.'),
});
export type GenerateComprehensiveFeedbackInput = z.infer<typeof GenerateComprehensiveFeedbackInputSchema>;

// Output schema for the comprehensive feedback generation flow
const GenerateComprehensiveFeedbackOutputSchema = z.object({
  studentTranscript: z.string().describe("The transcript of the student's speech."),
  aiFeedback: z.string().describe('The generated feedback for the student in Korean.'),
  teacherGuidance: z.string().describe('Actionable guidance for the teacher based on the performance in Korean.'),
  curricularRemarks: z.string().describe('A draft of curricular remarks suitable for the student’s academic record in Korean.'),
  score: z.number().int().min(0).max(100).describe('A score from 0-100 for the performance.'),
});
export type GenerateComprehensiveFeedbackOutput = z.infer<typeof GenerateComprehensiveFeedbackOutputSchema>;

export async function generateComprehensiveFeedback(input: GenerateComprehensiveFeedbackInput): Promise<GenerateComprehensiveFeedbackOutput> {
  return generateComprehensiveFeedbackFlow(input);
}

// 1. Define the prompt for generating the analysis and feedback
const feedbackGenerationPrompt = ai.definePrompt({
  name: 'feedbackGenerationPrompt',
  input: {
    schema: GenerateComprehensiveFeedbackInputSchema.extend({
      studentTranscript: z.string(),
    }).omit({ studentRecordingDataUri: true }),
  },
  output: { schema: GenerateComprehensiveFeedbackOutputSchema.omit({ studentTranscript: true }) },
  prompt: `You are an AI English Teacher evaluating a student's monologue performance. Your persona is that of an expert English teacher providing constructive feedback for skill improvement.
Your entire response must be in the specified JSON format, and all text feedback must be in Korean.

Here is the context for the evaluation:
- Student Name: {{{studentName}}}
- Assessment Title: {{{assessmentTitle}}}
- Activity Prompt: {{{activityPrompt}}}
- Expected Response Format/Grading Criteria: {{{expectedFormat}}}
- Student's Spoken Response (Transcript): {{{studentTranscript}}}

Based on all the information provided, perform the following tasks:

1.  **Generate Feedback for the Student:** Write encouraging and constructive feedback from the perspective of an English teacher. Focus on what they did well and what they can improve regarding fluency, pronunciation, grammar, and vocabulary in relation to the prompt. Include specific examples from their transcript. Suggest alternative English vocabulary or sentence structures where appropriate to help them improve.
2.  **Generate Guidance for the Teacher:** As an expert English teacher, provide actionable advice for the classroom teacher on how to help this specific student. Suggest specific English teaching activities, focus areas, or communication strategies based on the transcript analysis (e.g., "For vocabulary, try a 'word of the day' activity focusing on adjectives related to hobbies.").
3.  **Draft Curricular Remarks:** Write official curricular remarks in a formal, descriptive tone with sentences ending in '~함' or '~임'. The remarks must be based on the student's English speaking performance in this specific task. The remarks should summarize the student's performance on this task for their academic record, linking it to English language competencies. Follow a 3-part structure: ① General participation/attitude in the English speaking task, ② Specific examples from their speech and how it relates to English learning objectives (e.g., fluency, use of vocabulary, grammatical accuracy), ③ Collaboration, consideration for others, or other notable character traits observed during the activity.
4.  **Assign a Score:** Give a score from 0 to 100, where 100 is a perfect response that fully meets all criteria. Base the score on how well the student's response aligns with the activity prompt and expected format.
`,
});

// 2. Define the main flow
const generateComprehensiveFeedbackFlow = ai.defineFlow(
  {
    name: 'generateComprehensiveFeedbackFlow',
    inputSchema: GenerateComprehensiveFeedbackInputSchema,
    outputSchema: GenerateComprehensiveFeedbackOutputSchema,
  },
  async ({ studentRecordingDataUri, activityPrompt, expectedFormat, studentName, assessmentTitle }) => {
    
    // Handle cases with no audio data to prevent API errors.
    const audioData = studentRecordingDataUri.split(',')[1];
    if (!audioData) {
      return {
        studentTranscript: '(학생 답변이 기록되지 않았습니다.)',
        aiFeedback: '죄송합니다, 답변을 제대로 듣지 못했습니다. 마이크를 확인하고 다시 시도해주세요.',
        teacherGuidance: '학생 답변이 없어 조언 불가',
        curricularRemarks: '학생 답변이 없어 판별 불가',
        score: 0,
      };
    }

    // Step 1: Transcribe the student's audio recording, specifying English.
    const sttResponse = await ai.generate({
      model: googleAI.model('gemini-2.0-flash'),
      prompt: [
        { text: 'Transcribe this English audio.' },
        { media: { url: studentRecordingDataUri } },
      ],
    });
    const studentTranscript = sttResponse.text;

    if (!studentTranscript?.trim()) {
      // If transcription is empty, return a default "could not hear" response.
      return {
        studentTranscript: '(학생 답변이 기록되지 않았습니다.)',
        aiFeedback: '죄송합니다, 답변을 제대로 듣지 못했습니다. 마이크를 확인하고 다시 시도해주세요.',
        teacherGuidance: '학생 답변이 없어 조언 불가',
        curricularRemarks: '학생 답변이 없어 판별 불가',
        score: 0,
      };
    }

    // Step 2: Call the prompt to generate feedback, remarks, guidance, and score.
    const { output } = await feedbackGenerationPrompt({
      studentTranscript,
      activityPrompt,
      expectedFormat,
      studentName,
      assessmentTitle,
    });

    if (!output) {
        throw new Error("Failed to generate comprehensive feedback from the AI model.");
    }

    // Step 3: Return the combined result.
    return {
      studentTranscript,
      ...output,
    };
  }
);
