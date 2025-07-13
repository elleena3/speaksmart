export type Assessment = {
  id: string;
  title: string;
  topic: string;
  status: 'To Do' | 'Completed' | 'Graded';
  dueDate?: string;
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
  status: 'Submitted' | 'Graded';
  date: string;
};

export type TeacherAssessment = {
  id: string;
  title: string;
  studentsCompleted: number;
  totalStudents: number;
  averageScore: number;
  dateCreated: string;
};
