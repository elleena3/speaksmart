
'use server';

/**
 * @fileOverview Generates comprehensive feedback for a speaking assessment, including pronunciation analysis.
 * It transcribes student audio, then generates student feedback, teacher guidance, curricular remarks, a content score, and a pronunciation score.
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
  score: z.number().int().min(0).max(100).describe('A score from 0-100 for the performance content.'),
  pronunciationScore: z.number().int().min(0).max(100).describe('A score from 0-100 for pronunciation.'),
  pronunciationFeedback: z.string().describe('Specific feedback on the student\'s pronunciation in Korean.'),
});
export type GenerateComprehensiveFeedbackOutput = z.infer<typeof GenerateComprehensiveFeedbackOutputSchema>;

export async function generateComprehensiveFeedback(input: GenerateComprehensiveFeedbackInput): Promise<GenerateComprehensiveFeedbackOutput> {
  return generateComprehensiveFeedbackFlow(input);
}

// 1. Define the prompt for generating the content analysis and feedback
const contentFeedbackPrompt = ai.definePrompt({
  name: 'contentFeedbackPrompt',
  input: {
    schema: GenerateComprehensiveFeedbackInputSchema.extend({
      studentTranscript: z.string(),
    }).omit({ studentRecordingDataUri: true }),
  },
  output: { schema: GenerateComprehensiveFeedbackOutputSchema.omit({ studentTranscript: true, pronunciationScore: true, pronunciationFeedback: true }) },
  prompt: `You are an AI English Teacher evaluating a student's performance based on a transcript. Your persona is that of an expert English teacher providing constructive feedback for skill improvement.
Your entire response must be in the specified JSON format, and all text feedback must be in Korean.

Here is the context for the evaluation:
- Student Name: {{{studentName}}}
- Assessment Title: {{{assessmentTitle}}}
- Activity Prompt: {{{activityPrompt}}}
- Expected Response Format/Grading Criteria: {{{expectedFormat}}}
- Student's Spoken Response (Transcript): {{{studentTranscript}}}

Based on all the information provided, perform the following tasks:

1.  **Generate Feedback for the Student:** Write encouraging and constructive feedback from the perspective of an English teacher. Focus on what they did well and what they can improve regarding fluency, grammar, and vocabulary in relation to the prompt based *only on the transcript*. Include specific examples from their transcript. Suggest alternative English vocabulary or sentence structures where appropriate to help them improve. If the student's response is very short (e.g., just "Hello" or "Hi"), acknowledge their greeting positively and provide feedback on how they could have expanded their answer or continued the conversation (e.g., "Hello! 반갑게 인사해주었네요. 다음에는 'How are you?'라고 되묻거나, 대화를 이어갈 질문을 해보면 어떨까요?"). Do not say you could not hear them.
2.  **Generate Guidance for the Teacher:** As an expert English teacher, provide actionable advice for the classroom teacher on how to help this specific student. Suggest specific English teaching activities, focus areas, or communication strategies based on the transcript analysis (e.g., "For vocabulary, try a 'word of the day' activity focusing on adjectives related to hobbies."). If the student's response was short or hesitant, suggest activities to build confidence and encourage longer responses, such as role-playing or sentence-starter exercises.
3.  **Draft Curricular Remarks:** Write official curricular remarks in a formal, descriptive tone with sentences ending in '~함' or '~임'. The remarks must be based on the student's English speaking performance in this specific task. The remarks should summarize the student's performance on this task for their academic record, linking it to English language competencies. Follow a 3-part structure: ① General participation/attitude in the English speaking task, ② Specific examples from their speech (even if short, like "Hello.") and how it relates to English learning objectives (e.g., basic greeting, initiating conversation), ③ Collaboration, consideration for others, or other notable character traits observed during the activity. Even if the answer is very short, evaluate the act of participation itself.
4.  **Assign a Content Score:** Give a score from 0 to 100 for the *content* of the response, where 100 is a perfect response that fully meets all criteria. Base the score on how well the student's response aligns with the activity prompt and expected format, based on the transcript. A very short but correct answer like "Hello" should receive a low score (e.g., 5-10), not zero.
`,
});

// 2. Define the prompt for generating pronunciation feedback
const pronunciationFeedbackPrompt = ai.definePrompt({
    name: 'pronunciationFeedbackPrompt',
    input: {
        schema: z.object({
            studentRecordingDataUri: z.string(),
            studentTranscript: z.string(),
        })
    },
    output: { schema: GenerateComprehensiveFeedbackOutputSchema.pick({ pronunciationScore: true, pronunciationFeedback: true }) },
    prompt: `You are an expert English pronunciation coach. Your task is to evaluate a student's spoken English based on their audio recording and the corresponding transcript. Provide all feedback in Korean.

    - Student's Audio Recording: {{media url=studentRecordingDataUri}}
    - AI-generated Transcript: {{{studentTranscript}}}

    Please perform the following steps:
    1.  Listen carefully to the audio recording.
    2.  Compare the student's pronunciation with the words in the transcript.
    3.  Evaluate the student's pronunciation in terms of accuracy, clarity, intonation, and fluency.
    4.  **Assign a Pronunciation Score:** Give a score from 0 to 100. A score of 100 represents a native-like, clear pronunciation. A score of 0 means the speech is completely unintelligible.
    5.  **Provide Pronunciation Feedback:** Write specific, constructive feedback in Korean. Point out specific words or sounds that were pronounced well and those that need improvement. For words that need improvement, provide tips on how to pronounce them correctly (e.g., "The 'r' sound in 'friend' was a bit weak, try to curl your tongue more."). Be encouraging.
    
    If the transcript is very short (e.g., "Hi"), provide feedback on the pronunciation of that specific word. If the transcript is empty or indicates no speech, provide a score of 0 and state that no speech was detected.
    `,
});


// 3. Define the main flow
const generateComprehensiveFeedbackFlow = ai.defineFlow(
  {
    name: 'generateComprehensiveFeedbackFlow',
    inputSchema: GenerateComprehensiveFeedbackInputSchema,
    outputSchema: GenerateComprehensiveFeedbackOutputSchema,
  },
  async ({ studentRecordingDataUri, activityPrompt, expectedFormat, studentName, assessmentTitle }) => {
    
    const audioData = studentRecordingDataUri.split(',')[1];
    // This check is for completely empty/invalid data URIs.
    if (!audioData) {
      return {
        studentTranscript: '(학생 답변이 기록되지 않았습니다.)',
        aiFeedback: '죄송합니다, 답변을 제대로 듣지 못했습니다. 마이크를 확인하고 다시 시도해주세요.',
        teacherGuidance: '학생 답변이 없어 조언 불가',
        curricularRemarks: '학생 답변이 없어 판별 불가',
        score: 0,
        pronunciationScore: 0,
        pronunciationFeedback: '녹음된 오디오가 없어 발음 분석을 할 수 없습니다.',
      };
    }

    let studentTranscript = "";
    const dialogueMarker = '--- 대화 기록 ---\n';
    let isDialogue = activityPrompt.includes(dialogueMarker);

    if (isDialogue) {
        studentTranscript = activityPrompt.substring(activityPrompt.indexOf(dialogueMarker) + dialogueMarker.length);
    } else {
        const sttResponse = await ai.generate({
          model: googleAI.model('gemini-2.0-flash'),
          prompt: [
            { text: 'Transcribe this English audio.' },
            { media: { url: studentRecordingDataUri } },
          ],
        });
        studentTranscript = sttResponse.text;
    }

    // This check is for when transcription returns nothing.
    if (!studentTranscript) {
      return {
        studentTranscript: '(학생 답변이 기록되지 않았습니다.)',
        aiFeedback: '죄송합니다, 답변을 제대로 듣지 못했습니다. 마이크를 확인하고 다시 시도해주세요.',
        teacherGuidance: '학생 답변이 없어 조언 불가',
        curricularRemarks: '학생 답변이 없어 판별 불가',
        score: 0,
        pronunciationScore: 0,
        pronunciationFeedback: '음성 인식 결과가 없어 발음 분석을 할 수 없습니다.',
      };
    }
    
    // For dialogue, we cannot do pronunciation analysis without the student's isolated audio.
    if (isDialogue) {
        const contentResult = await contentFeedbackPrompt({
            studentTranscript,
            activityPrompt,
            expectedFormat,
            studentName,
            assessmentTitle,
        });

        if (!contentResult.output) {
             throw new Error("Failed to generate content feedback from the AI model.");
        }
        
        return {
          studentTranscript,
          ...contentResult.output,
          pronunciationScore: 0,
          pronunciationFeedback: "대화 형식 평가에서는 개별 발음 분석을 제공하지 않습니다. 종합 피드백을 참고해주세요.",
        };

    } else {
        // For monologue, run content and pronunciation analysis in parallel.
        const [contentResult, pronunciationResult] = await Promise.all([
            contentFeedbackPrompt({
                studentTranscript,
                activityPrompt,
                expectedFormat,
                studentName,
                assessmentTitle,
            }),
            pronunciationFeedbackPrompt({
                studentRecordingDataUri,
                studentTranscript,
            }),
        ]);

        const contentOutput = contentResult.output;
        const pronunciationOutput = pronunciationResult.output;

        if (!contentOutput || !pronunciationOutput) {
            throw new Error("Failed to generate comprehensive feedback from the AI model.");
        }
        
        return {
          studentTranscript,
          ...contentOutput,
          ...pronunciationOutput,
        };
    }
  }
);
