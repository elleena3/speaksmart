import { type ConversationTurn } from "@/lib/types/ai-schemas";

export type Assessment = {
  id: string;
  title: string;
  topic: string;
  status: '할 일' | '완료' | '채점 완료';
  special?: boolean;
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
  studentsCompleted: number;
  totalStudents: number;
  averageScore: number;
  dateCreated: string;
  startDate?: Date;
  endDate?: Date;
};

// Add conversation history type to be stored in localStorage
export type ConversationHistory = {
  history: ConversationTurn[];
}
