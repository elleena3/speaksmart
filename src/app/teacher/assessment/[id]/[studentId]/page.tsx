
"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Paperclip, Download, User, Activity, BookText } from "lucide-react"
import { type TeacherAssessment, type StudentResult } from "@/lib/types";
import { useLanguage } from "@/context/language-context";

// This is just to define the type for mock data structure
const mockStudentData = {
  studentId: "student-alex-doe",
  name: "Alex Doe",
  avatarUrl: "https://placehold.co/80x80.png",
  assessmentId: "3",
  curricularRemarks: "학생은 주어진 주제에 대해 논리적으로 자신의 경험을 잘 설명함. 특히, 과거 시제를 적절히 사용하여 문장을 구성하는 능력이 돋보임. 어휘 사용 범위가 다소 제한적이었으나, 핵심 내용은 명확하게 전달함. 발음은 대체로 양호하나, 일부 단어에서 강세 위치를 개선할 필요가 있음. 전반적으로 성실하게 과제에 임하는 태도가 긍정적임.",
  studentFeedbackSummary: "학생은 평가 주제가 흥미로웠다고 응답했으나, 답변 준비 시간이 조금 더 길었으면 좋겠다는 의견을 제시함. AI의 피드백이 전반적으로 도움이 되었다고 평가함.",
  teacherGuidance: "이 학생은 문법 구조에 대한 이해도가 높습니다. 다양한 어휘를 사용할 수 있도록 유의어 및 관련 표현 학습을 독려해주세요. 역할극이나 짧은 발표 활동을 통해 자신감을 키워주는 것이 도움이 될 것입니다."
};

const initialAssessments: TeacherAssessment[] = [
    { id: "1", title: "5단원: 나의 일과", studentsCompleted: 18, totalStudents: 20, averageScore: 85, dateCreated: "2024-05-10", assessmentType: "monologue", prompt: "" },
    { id: "2", title: "6단원: 사람 묘사하기", studentsCompleted: 15, totalStudents: 20, averageScore: 78, dateCreated: "2024-05-17", assessmentType: "monologue", prompt: "" },
    { id: "3", title: "중간 말하기 시험", studentsCompleted: 20, totalStudents: 20, averageScore: 91, dateCreated: "2024-05-24", assessmentType: "monologue", prompt: "" },
    { id: "4", title: "7단원: 취미와 관심사", studentsCompleted: 0, totalStudents: 20, averageScore: 0, dateCreated: "2024-05-31", assessmentType: "monologue", prompt: "" },
];


export default function StudentResultPage() {
  const params = useParams();
  const { t } = useLanguage();
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [student, setStudent] = useState<StudentResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const studentId = Array.isArray(params.studentId) ? params.studentId[0] : params.studentId;

  useEffect(() => {
    if (assessmentId && studentId) {
        // Fetch assessment details
        const storedTeacherAssessments: TeacherAssessment[] = JSON.parse(localStorage.getItem('assessments') || '[]');
        const allAssessments = [...initialAssessments, ...storedTeacherAssessments];
        const foundAssessment = allAssessments.find(a => a.id === assessmentId);

        // Fetch student result details
        const allStudentResults: StudentResult[] = JSON.parse(localStorage.getItem('student_results') || '[]');
        const foundStudentResult = allStudentResults.find(r => r.assessmentId === assessmentId && r.studentId === studentId);

        if (foundAssessment && foundStudentResult) {
            setAssessment(foundAssessment);
            setStudent(foundStudentResult);
        } else {
            notFound();
        }
        setIsLoading(false);
    }
  }, [assessmentId, studentId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assessment || !student) {
    return null; // Should be handled by notFound()
  }

  const isDialogue = assessment.assessmentType === 'dialogue';

  return (
    <div className="space-y-6">
       <Card>
          <CardHeader className="flex-row items-center gap-4 space-y-0">
             <Avatar className="h-16 w-16">
                <AvatarImage src={student.avatarUrl} alt={student.name} data-ai-hint="person portrait" />
                <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl">{student.name} 학생 결과</CardTitle>
              <CardDescription>평가: <span className="font-semibold">{assessment.title}</span></CardDescription>
            </div>
          </CardHeader>
       </Card>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookText className="h-5 w-5 text-primary"/> 교과과정 비고 초안</CardTitle>
            <CardDescription>학생의 성과에 기반한 AI 생성 초안입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea readOnly value={student.curricularRemarks} className="h-48 bg-muted/50 font-mono text-sm" />
            <Button className="w-full mt-4">
              <Paperclip className="mr-2 h-4 w-4" /> 생활기록부에 저장
            </Button>
          </CardContent>
        </Card>
        
        <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary"/> 학생 피드백 요약</CardTitle>
                 <CardDescription>이 평가 활동에 대한 학생의 AI 요약 피드백입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg italic">
                    {student.studentFeedbackSummary}
                 </div>
                <Button variant="outline" className="w-full mt-4">
                  <Download className="mr-2 h-4 w-4" /> 전체 피드백 다운로드
                </Button>
              </CardContent>
            </Card>

            {isDialogue && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/> 선생님을 위한 조언</CardTitle>
                  <CardDescription>학생의 대화 분석에 기반한 AI 조언입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
                    {student.teacherGuidance}
                  </div>
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </div>
  )
}
