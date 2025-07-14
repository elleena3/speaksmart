import { type ConversationTurn } from "@/lib/types/ai-schemas";

export const scenarios = ["free-talk", "ordering-food", "airport-check-in", "shopping"] as const;
export type Scenario = (typeof scenarios)[number];

export type Assessment = {
  id: string;
  title: string;
  topic: string;
  prompt: string;
  status: '할 일' | '완료' | '채점 완료';
  assessmentType: 'monologue' | 'dialogue';
  scenario?: Scenario;
  // Firestore fields
  uid?: string; // Teacher's UID
  createdAt?: number; 
};

export type Student = {
  id: string; // Corresponds to Firebase Auth UID
  name: string;
  avatar: string;
  email: string;
};

export type TeacherAssessment = {
  id: string; // Firestore document ID
  uid: string; // Teacher's UID
  title: string;
  topic: string;
  prompt: string;
  averageScore: number;
  dateCreated: string;
  startDate?: Date;
  endDate?: Date;
  assessmentType: 'monologue' | 'dialogue';
  scenario?: Scenario;
  expectedFormat?: string;
  recordingTimeLimit?: number; // Optional recording time limit in minutes
  // For Firestore timestamp
  createdAt: number;
};

// Add conversation history type to be stored in localStorage/sessionStorage
export type ConversationHistory = {
  history: ConversationTurn[];
  studentRecordingDataUri?: string;
}

export type StudentResult = {
  id: string; // Firestore document ID
  studentId: string; // Student's UID
  assessmentId: string;
  assessmentTitle: string; 
  name: string; // Student's display name
  avatarUrl: string;
  status: "채점 완료" | "채점 중" | "오류";
  score: number;
  date: string;
  aiFeedback: string;
  curricularRemarks: string;
  studentFeedbackSummary: string;
  teacherGuidance: string;
  studentTranscript?: string;
  studentRecordingDataUri?: string;
  pronunciationScore?: number;
  pronunciationFeedback?: string;
  teacherUid: string; // To query results by teacher
  createdAt: number;
}
