import { z } from 'genkit';
import { scenarios } from '@/lib/types';

// Define the structure for a single message in the conversation history
export const ConversationTurnSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string(),
});
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

// Define the input schema for the main flow
export const ConverseWithStudentInputSchema = z.object({
  studentRecordingDataUri: z
    .string()
    .describe(
      "The student's voice recording as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ).nullable(), // Allow null for initial greeting
  conversationHistory: z
    .array(ConversationTurnSchema)
    .describe('The history of the conversation so far.'),
  scenario: z.enum(scenarios).optional().describe('The role-playing scenario for the conversation.'),
  scenarioPrompt: z.string().optional().describe('The teacher-provided prompt for the role-playing scenario.'),
});
export type ConverseWithStudentInput = z.infer<typeof ConverseWithStudentInputSchema>;

// Define the output schema for the main flow
export const ConverseWithStudentOutputSchema = z.object({
  aiResponseText: z.string().describe('The text of the AI conversational partner.'),
  aiResponseAudioDataUri: z.string().describe("The AI's response as a playable audio data URI."),
  studentTranscript: z.string().describe("The transcript of the student's speech."),
});
export type ConverseWithStudentOutput = z.infer<typeof ConverseWithStudentOutputSchema>;


// Schemas for the comprehensive speaking analysis flow
export const GenerateSpeakingAnalysisInputSchema = z.object({
  studentRecordingDataUri: z.string().describe(
    "The student's voice recording as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
  ),
  activityPrompt: z.string().describe('The prompt or instructions for the speaking activity.'),
  expectedFormat: z.string().describe('The expected format or key points of the response for grading.'),
  studentName: z.string().describe('The name of the student.'),
  assessmentTitle: z.string().describe('The title of the assessment.'),
  // Add fields needed to create the result document
  studentId: z.string(),
  assessmentId: z.string(),
  teacherUid: z.string(),
  avatarUrl: z.string(),
});
export type GenerateSpeakingAnalysisInput = z.infer<typeof GenerateSpeakingAnalysisInputSchema>;

export const GenerateSpeakingAnalysisOutputSchema = z.object({
  resultId: z.string().describe('The ID of the created Firestore result document.'),
});
export type GenerateSpeakingAnalysisOutput = z.infer<typeof GenerateSpeakingAnalysisOutputSchema>;


// Internal schemas for sub-prompts within the main analysis flow
export const ContentAnalysisInputSchema = z.object({
    studentTranscript: z.string(),
    activityPrompt: z.string(),
    expectedFormat: z.string(),
    studentName: z.string(),
    assessmentTitle: z.string(),
});

export const ContentAnalysisOutputSchema = z.object({
    aiFeedback: z.string().describe('The generated feedback for the student in Korean.'),
    teacherGuidance: z.string().describe('Actionable guidance for the teacher based on the performance in Korean.'),
    curricularRemarks: z.string().describe('A draft of curricular remarks suitable for the student’s academic record in Korean.'),
    contentScore: z.number().int().min(0).max(100).describe('A score from 0-100 for the performance content.'),
});

export const PronunciationAnalysisInputSchema = z.object({
    studentRecordingDataUri: z.string(),
    studentTranscript: z.string(),
});

export const PronunciationAnalysisOutputSchema = z.object({
    pronunciationScore: z.number().int().min(0).max(100).describe('A score from 0-100 for pronunciation.'),
    pronunciationFeedback: z.string().describe('Specific, constructive feedback on the student\'s pronunciation in Korean.'),
});
