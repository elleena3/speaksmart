

import { type ConversationTurn, type ResultSummarySchema } from "@/lib/types/ai-schemas";
import { z } from 'zod';

export const scenarios = ["free-talk", "ordering-food", "airport-check-in", "shopping"] as const;
export type Scenario = (typeof scenarios)[number];

// Google Cloud TTS Voice list updated for accuracy
export const femaleVoices = ["laomedeia", "callirrhoe", "autonoe", "erinome"] as const;
export const maleVoices = ["achernar", "algenib", "gacrux", "iapetus", "orus", "puck", "schedar", "zubenelgenubi"] as const;
export const allVoices = [...femaleVoices, ...maleVoices] as const;
export type AiVoice = (typeof allVoices)[number];

// Descriptions updated for accuracy
export const voiceDescriptions: Record<AiVoice, string> = {
    // Female
    laomedeia: "부드럽고 차분한 톤 (여성)",
    callirrhoe: "안정적이고 신뢰감 있는 톤 (여성)",
    autonoe: "활기차고 밝은 톤 (여성)",
    erinome: "깊고 성숙한 톤 (여성)",
    // Male
    achernar: "명료하고 전문적인 톤 (남성)",
    algenib: "중립적이고 표준적인 톤 (남성)",
    gacrux: "부드럽고 감성적인 톤 (남성)",
    iapetus: "깊고 권위 있는 톤 (남성)",
    orus: "활기차고 설득력 있는 톤 (남성)",
    puck: "명료하고 교육적인 톤 (남성)",
    schedar: "따뜻하고 친근한 톤 (남성)",
    zubenelgenubi: "밝고 긍정적인 톤 (남성)",
};

export const evaluationModels = ["gemini-2.5-flash", "gemini-2.5-flash-lite-preview-06-17", "gemini-2.0-flash"] as const;
export type EvaluationModel = (typeof evaluationModels)[number];

// New UserData type for Firestore
export type UserData = {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    role: 'student' | 'teacher';
    grade?: string;
    class?: string;
    number?: string;
    password?: string; // Storing password in plaintext for simplicity as requested.
    createdAt: number;
    docId?: string; // Firestore document ID
};


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
  submissionCount: number;
  dateCreated: string;
  startDate?: string;
  endDate?: string;
  assessmentType: 'monologue' | 'dialogue';
  scenario?: Scenario;
  aiVoice?: AiVoice;
  evaluationModel?: EvaluationModel;
  expectedFormat?: string;
  recordingTimeLimit?: number; // Optional recording time limit in minutes
  targetStudentIds: string[] | 'all'; // 'all' or array of student UIDs
  useRubric?: boolean; // New field for rubric option
  // For Firestore timestamp
  createdAt: number;
  submissions?: { [studentId: string]: 'completed' | 'in_progress' };
};

export type { ConversationTurn };
export type ResultSummary = z.infer<typeof ResultSummarySchema>;

export type ConversationHistory = {
  history: ConversationTurn[];
  studentRecordingUrl?: string;
}

export type ResultStatus = 
  | "채점 완료" 
  | "오류" 
  | "분석 중"
  | "분석 중: upload"
  | "분석 중: transcribe"
  | "분석 중: analyze"
  | "분석 중: report";


export type RubricScores = {
    fluency: number;
    pronunciation: number;
    grammar: number;
    vocabulary: number;
    interaction?: number; // Optional for monologue
};

export type HistoricalScore = {
    attempt: number;
    contentScore: number;
    pronunciationScore: number;
    rubricScores?: RubricScores;
};

export type StudentResult = {
  id: string; // Firestore document ID
  studentId: string; // Student's UID
  assessmentId: string;
  assessmentTitle: string; 
  assessmentType?: 'monologue' | 'dialogue'; // Keep track of type for reprocessing
  name: string; // Student's display name
  avatarUrl: string;
  status: ResultStatus;
  date: string;
  aiFeedback: string;
  studentFeedbackSummary: string;
  studentRawFeedback?: string; // 원본 피드백 저장
  teacherGuidance: string;
  pronunciationFeedback: string;
  studentTranscript?: string;
  studentRecordingUrl?: string; // Changed from DataUri to URL
  pronunciationScore?: number;
  teacherUid: string; // To query results by teacher
  createdAt: number;
  contentScore: number;
  curricularRemarks: string;
  rubricScores?: RubricScores;
  // New fields for cached growth feedback
  growthFeedback?: string;
  growthTeacherGuidance?: string;
  growthCurricularRemarks?: string;
  growthFeedbackForAttempts?: number;
  // New field for cached chart data
  historicalScores?: HistoricalScore[];
}
