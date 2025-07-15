
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


// ##############################################################
// ##                SCHEMAS FOR ANALYSIS FLOWS                ##
// ##############################################################

// Internal schemas for sub-prompts, used by both flows
export const ContentAnalysisOutputSchema = z.object({
    aiFeedback: z.string().describe('The generated feedback for the student in Korean.'),
    teacherGuidance: z.string().describe('Actionable guidance for the teacher based on the performance in Korean.'),
    curricularRemarks: z.string().describe('A draft of curricular remarks suitable for the student’s academic record in Korean.'),
    contentScore: z.number().int().min(0).max(100).describe('A score from 0-100 for the performance content.'),
});

export const PronunciationAnalysisOutputSchema = z.object({
    pronunciationScore: z.number().int().min(0).max(100).describe('A score from 0-100 for pronunciation.'),
    pronunciationFeedback: z.string().describe('Specific, constructive feedback on the student\'s pronunciation in Korean.'),
});

export const CombinedAnalysisOutputSchema = z.object({
    studentTranscript: z.string(),
    contentScore: z.number(),
    aiFeedback: z.string(),
    teacherGuidance: z.string(),
    curricularRemarks: z.string(),
    pronunciationScore: z.number(),
    pronunciationFeedback: z.string(),
});


// Schemas for the MONOLOGUE analysis flow
export const GenerateMonologueAnalysisInputSchema = z.object({
  studentRecordingGcsUri: z.string().describe(
    "The student's voice recording as a Google Cloud Storage URI. Expected format: 'gs://<bucket-name>/<file-path>'"
  ),
  activityPrompt: z.string().describe('The prompt or instructions for the speaking activity.'),
  expectedFormat: z.string().describe('The expected format or key points of the response for grading.'),
  studentName: z.string().describe('The name of the student.'),
  assessmentTitle: z.string().describe('The title of the assessment.'),
});
export type GenerateMonologueAnalysisInput = z.infer<typeof GenerateMonologueAnalysisInputSchema>;


// Schemas for the DIALOGUE analysis flow
export const GenerateDialogueAnalysisInputSchema = z.object({
  studentRecordingGcsUri: z.string().describe("The student's combined voice recording as a GCS URI."),
  studentTranscript: z.string().describe("The transcript of only the student's speech, used for pronunciation analysis."),
  fullConversationTranscript: z.string().describe("The full transcript of the conversation between the student and AI."),
  activityPrompt: z.string().describe('The prompt or instructions for the speaking activity.'),
  expectedFormat: z.string().describe('The expected format or key points of the response for grading.'),
  studentName: z.string().describe('The name of the student.'),
  assessmentTitle: z.string().describe('The title of the assessment.'),
});
export type GenerateDialogueAnalysisInput = z.infer<typeof GenerateDialogueAnalysisInputSchema>;

    
