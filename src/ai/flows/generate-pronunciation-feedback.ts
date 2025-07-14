
'use server';

/**
 * @fileOverview Generates pronunciation analysis for a speaking assessment.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Input schema for the pronunciation feedback generation flow
const GeneratePronunciationFeedbackInputSchema = z.object({
  studentRecordingDataUri: z.string().describe(
    "The student's voice recording as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
  ),
  studentTranscript: z.string().describe("The transcript of the student's speech, used for comparison."),
});
export type GeneratePronunciationFeedbackInput = z.infer<typeof GeneratePronunciationFeedbackInputSchema>;

// Output schema for the pronunciation feedback generation flow
const GeneratePronunciationFeedbackOutputSchema = z.object({
  pronunciationScore: z.number().int().min(0).max(100).describe('A score from 0-100 for pronunciation.'),
  pronunciationFeedback: z.string().describe('Specific feedback on the student\'s pronunciation in Korean.'),
});
export type GeneratePronunciationFeedbackOutput = z.infer<typeof GeneratePronunciationFeedbackOutputSchema>;


export async function generatePronunciationFeedback(input: GeneratePronunciationFeedbackInput): Promise<GeneratePronunciationFeedbackOutput> {
  return generatePronunciationFeedbackFlow(input);
}


// Define the prompt for generating pronunciation feedback
const pronunciationFeedbackPrompt = ai.definePrompt({
    name: 'pronunciationFeedbackPrompt',
    input: { schema: GeneratePronunciationFeedbackInputSchema },
    output: { schema: GeneratePronunciationFeedbackOutputSchema },
    prompt: `You are an expert English pronunciation coach. Your task is to evaluate a student's spoken English based on their audio recording and the corresponding transcript. Provide all feedback in Korean.

    - Student's Audio Recording: {{media url=studentRecordingDataUri}}
    - AI-generated Transcript: {{{studentTranscript}}}

    Please perform the following steps:
    1.  Listen carefully to the audio recording.
    2.  Compare the student's pronunciation with the words in the transcript.
    3.  Evaluate the student's pronunciation in terms of accuracy, clarity, intonation, and fluency.
    4.  **Assign a Pronunciation Score:** Give a score from 0 to 100. A score of 100 represents a native-like, clear pronunciation. A score of 0 means the speech is completely unintelligible.
    5.  **Provide Pronunciation Feedback:** Write specific, constructive feedback in Korean. Point out specific words or sounds that were pronounced well and those that need improvement. For words that need improvement, provide tips on how to pronounce them correctly (e.g., "The 'r' sound in 'friend' was a bit weak, try to curl your tongue more."). Be encouraging.
    
    If the transcript is very short (e.g., "Hi"), provide feedback on the pronunciation of that specific word. If the transcript is empty or indicates no speech was detected, provide a score of 0 and state that no speech was detected.
    `,
});


const generatePronunciationFeedbackFlow = ai.defineFlow(
  {
    name: 'generatePronunciationFeedbackFlow',
    inputSchema: GeneratePronunciationFeedbackInputSchema,
    outputSchema: GeneratePronunciationFeedbackOutputSchema,
  },
  async ({ studentRecordingDataUri, studentTranscript }) => {
    
    const audioData = studentRecordingDataUri.split(',')[1];
    if (!audioData || !studentTranscript) {
      return {
        pronunciationScore: 0,
        pronunciationFeedback: '녹음된 오디오 또는 텍스트가 없어 발음 분석을 할 수 없습니다.',
      };
    }

    const { output } = await pronunciationFeedbackPrompt({
        studentRecordingDataUri,
        studentTranscript,
    });

    if (!output) {
        throw new Error("Failed to generate pronunciation feedback from the AI model.");
    }
    
    return output;
  }
);
