
import { type ConversationTurn } from "@/lib/types/ai-schemas";

export const scenarios = ["free-talk", "ordering-food", "airport-check-in", "shopping"] as const;
export type Scenario = (typeof scenarios)[number];

export const femaleVoices = ["Alpheratz", "Achernar", "Vega", "Capella", "Procyon", "Sirius"] as const;
export const maleVoices = ["Algenib", "Polaris", "Antares", "Arcturus", "Spica", "Regulus"] as const;
export const allVoices = [...femaleVoices, ...maleVoices] as const;
export type AiVoice = (typeof allVoices)[number];

export const voiceDescriptions: Record<AiVoice, string> = {
    // Female
    Alpheratz: "따뜻하고 친근한 톤",
    Achernar: "명료하고 전문적인 톤",
    Vega: "활기차고 밝은 톤",
    Capella: "부드럽고 차분한 톤",
    Procyon: "안정적이고 신뢰감 있는 톤",
    Sirius: "깊고 성숙한 톤",
    // Male
    Algenib: "중립적이고 표준적인 톤",
    Polaris: "깊고 권위 있는 톤",
    Antares: "부드럽고 감성적인 톤",
    Arcturus: "활기차고 설득력 있는 톤",
    Spica: "명료하고 교육적인 톤",
    Regulus: "밝고 긍정적인 톤",
};

export const evaluationModels = ["gemini-2.5-flash-lite-preview-06-17", "gemini-2.5-flash", "gemini-2.0-flash"] as const;
export type EvaluationModel = (typeof evaluationModels)[number];


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
  // For Firestore timestamp
  createdAt: number;
};

export type { ConversationTurn };

export type ConversationHistory = {
  history: ConversationTurn[];
  studentRecordingUrl?: string;
}

export type ResultStatus = 
  | "채점 완료" 
  | "오류" 
  | "분석 중"
  | "파일 업로드 중..."
  | "텍스트 변환 중"
  | "내용 및 발음 분석 중..."
  | "리포트 생성 중";


export type StudentResult = {
  id: string; // Firestore document ID
  studentId: string; // Student's UID
  assessmentId: string;
  assessmentTitle: string; 
  name: string; // Student's display name
  avatarUrl: string;
  status: ResultStatus;
  score: number;
  date: string;
  aiFeedback: string;
  curricularRemarks: string;
  studentFeedbackSummary: string;
  teacherGuidance: string;
  studentTranscript?: string;
  studentRecordingUrl?: string; // Changed from DataUri to URL
  pronunciationScore?: number;
  pronunciationFeedback?: string;
  teacherUid: string; // To query results by teacher
  createdAt: number;
}
