

import { z } from 'genkit';
import { scenarios, allVoices, evaluationModels } from '@/lib/types';
import type { StudentResult } from '@/lib/types';


// Define the structure for a single message in the conversation history
export const ConversationTurnSchema = z.object({
  role: z.enum(['user', 'model', 'user_interim']),
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
  aiVoice: z.enum(allVoices).optional().describe("The voice for the AI to use for text-to-speech."),
  evaluationModel: z.enum(evaluationModels).optional().describe("The AI model to use for generating responses."),
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
export const RubricScoresSchema = z.object({
    fluency: z.number(),
    pronunciation: z.number(),
    grammar: z.number(),
    vocabulary: z.number(),
    interaction: z.number().optional(),
});

// Internal schemas for sub-prompts, used by both flows
export const ContentAnalysisOutputSchema = z.object({
    aiFeedback: z.string().describe('The generated feedback for the student in Korean.'),
    teacherGuidance: z.string().describe('Actionable guidance for the teacher based on the performance in Korean.'),
    contentScore: z.number().int().min(0).max(100).describe('A score from 0-100 for the performance content.'),
    curricularRemarks: z.string().describe('A draft of school record remarks, in formal Korean.'),
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
    rubricScores: RubricScoresSchema.optional(),
});


// Schemas for the MONOLOGUE analysis flow
export const GenerateMonologueAnalysisInputSchema = z.object({
  studentRecordingDataUri: z.string().describe(
    "The student's voice recording as a data URI."
  ),
  activityPrompt: z.string().describe('The prompt or instructions for the speaking activity.'),
  expectedFormat: z.string().describe('The expected format or key points of the response for grading.'),
  studentName: z.string().describe('The name of the student.'),
  assessmentTitle: z.string().describe('The title of the assessment.'),
  evaluationModel: z.enum(evaluationModels).optional(),
  useRubric: z.boolean().optional().describe('Whether to use the standardized rubric for evaluation.'),
  resultId: z.string().describe('The Firestore document ID for the result to update progress.'),
  teacherUid: z.string().describe("The UID of the teacher who created the assessment."),
});
export type GenerateMonologueAnalysisInput = z.infer<typeof GenerateMonologueAnalysisInputSchema>;


// Schemas for the DIALOGUE analysis flow
export const GenerateDialogueAnalysisInputSchema = z.object({
  studentRecordingUrl: z.string().describe("A direct download URL to the student's combined voice recording."),
  studentTranscript: z.string().describe("The transcript of only the student's speech, used for pronunciation analysis."),
  fullConversationTranscript: z.string().describe("The full transcript of the conversation between the student and AI."),
  activityPrompt: z.string().describe('The prompt or instructions for the speaking activity.'),
  expectedFormat: z.string().describe('The expected format or key points of the response for grading.'),
  studentName: z.string().describe('The name of the student.'),
  assessmentTitle: z.string().describe('The title of the assessment.'),
  evaluationModel: z.enum(evaluationModels).optional(),
  useRubric: z.boolean().optional().describe('Whether to use the standardized rubric for evaluation.'),
  resultId: z.string().describe('The Firestore document ID for the result to update progress.'),
  teacherUid: z.string().describe("The UID of the teacher who created the assessment."),
});
export type GenerateDialogueAnalysisInput = z.infer<typeof GenerateDialogueAnalysisInputSchema>;


// ##############################################################
// ##              SCHEMA FOR GROWTH FEEDBACK FLOW             ##
// ##############################################################

export const ResultSummarySchema = z.object({
    attemptNumber: z.number().int(),
    contentScore: z.number().int(),
    pronunciationScore: z.number().int(),
    transcript: z.string(),
    aiFeedback: z.string(),
});

export const GenerateGrowthFeedbackInputSchema = z.object({
    attempts: z.array(ResultSummarySchema).describe("An array of all the student's attempts, from oldest to newest."),
    assessmentTitle: z.string(),
});
export type GenerateGrowthFeedbackInput = z.infer<typeof GenerateGrowthFeedbackInputSchema>;

export const GenerateGrowthFeedbackOutputSchema = z.object({
    growthFeedback: z.string().describe("A comprehensive Markdown-formatted analysis of the student's growth."),
    teacherGuidance: z.string().describe("Actionable advice for the teacher based on the student's entire journey."),
    curricularRemarks: z.string().describe("A comprehensive school record remark based on the student's entire journey."),
});
export type GenerateGrowthFeedbackOutput = z.infer<typeof GenerateGrowthFeedbackOutputSchema>;


// ##############################################################
// ##                SCHEMA FOR RETRYING FLOW                  ##
// ##############################################################
export const RetryAnalysisInputSchema = z.object({
  resultId: z.string().describe('The Firestore document ID of the result to retry.'),
});
export type RetryAnalysisInput = z.infer<typeof RetryAnalysisInputSchema>;

// ##############################################################
// ##        SCHEMAS FOR READ ALOUD TOOL 2.0 (ENHANCED)        ##
// ##############################################################
export const EnhanceSelectedTextInputSchema = z.object({
  selectedText: z.string().describe("The (potentially imprecise) text snippet selected by the user."),
  fullSentenceContext: z.string().describe("The full sentence or paragraph containing the selected text, for context."),
  action: z.enum(['translate', 'define', 'explain']).describe("The action to perform on the corrected text."),
});
export type EnhanceSelectedTextInput = z.infer<typeof EnhanceSelectedTextInputSchema>;

export const EnhanceSelectedTextOutputSchema = z.object({
  correctedText: z.string().describe("The most likely word or phrase the user intended to select."),
  result: z.string().describe("The result of the requested action (translation, definition, or explanation) in Korean."),
});
export type EnhanceSelectedTextOutput = z.infer<typeof EnhanceSelectedTextOutputSchema>;

export const ReadAloudInputSchema = z.object({
    text: z.string().describe("The text to be read aloud.")
});
export type ReadAloudInput = z.infer<typeof ReadAloudInputSchema>;

export const ReadAloudOutputSchema = z.object({
    audioDataUri: z.string().describe("The AI's reading of the text as a playable audio data URI.")
});
export type ReadAloudOutput = z.infer<typeof ReadAloudOutputSchema>;
