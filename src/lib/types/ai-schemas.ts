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


// Schemas for Free Talk Feedback Flow
export const GenerateFreeTalkFeedbackInputSchema = z.object({
  conversationTranscript: z
    .string()
    .describe('The full transcript of the conversation between the AI and the student.'),
});
export type GenerateFreeTalkFeedbackInput = z.infer<typeof GenerateFreeTalkFeedbackInputSchema>;

const RubricItemSchema = z.object({
  score: z.number().describe('The score for this category, from 1 to 5.'),
  feedback: z.string().describe('Specific feedback for this category.'),
});

export const GenerateFreeTalkFeedbackOutputSchema = z.object({
  studentFeedback: z.object({
    overall: z.string().describe('Overall feedback for the student in Korean.'),
    rubric: z.object({
      fluency: RubricItemSchema.describe('Assessment of the flow and smoothness of speech.'),
      pronunciation: RubricItemSchema.describe('Assessment of the clarity of speech and sounds.'),
      vocabulary: RubricItemSchema.describe('Assessment of the range and appropriateness of word choice.'),
      grammar: RubricItemSchema.describe('Assessment of the accuracy of sentence structure.'),
    }),
  }),
  teacherGuidance: z
    .string()
    .describe(
      'Actionable guidance for the teacher on how to help this student improve, in Korean.'
    ),
});
export type GenerateFreeTalkFeedbackOutput = z.infer<typeof GenerateFreeTalkFeedbackOutputSchema>;
