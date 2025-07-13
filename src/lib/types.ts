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
};

export type Student = {
  id: string;
  name: string;
  avatar: string;
};

export type Submission = {
  studentId: string;
  assessmentId: string;
  score?: number;
  status: '제출' | '채점 완료';
  date: string;
};

export type TeacherAssessment = {
  id: string;
  title: string;
  topic: string;
  prompt: string;
  studentsCompleted: number;
  totalStudents: number;
  averageScore: number;
  dateCreated: string;
  startDate?: Date;
  endDate?: Date;
  assessmentType: 'monologue' | 'dialogue';
  scenario?: Scenario;
};

// Add conversation history type to be stored in localStorage
export type ConversationHistory = {
  history: ConversationTurn[];
}

export type StudentResult = {
  studentId: string;
  assessmentId: string;
  name: string;
  avatarUrl: string;
  status: "채점 완료";
  score: number;
  date: string;
  aiFeedback: string;
  curricularRemarks: string;
  studentFeedbackSummary: string;
  teacherGuidance: string;
}
