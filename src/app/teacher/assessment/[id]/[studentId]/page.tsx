
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Paperclip, Download, User, Activity, BookText, FileText, Target } from "lucide-react"
import { type TeacherAssessment, type StudentResult } from "@/lib/types";
import { useLanguage } from "@/context/language-context";
import { Progress } from "@/components/ui/progress";

export default function StudentResultPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [student, setStudent] = useState<StudentResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const studentId = Array.isArray(params.studentId) ? params.studentId[0] : params.id;

  useEffect(() => {
    if (assessmentId && studentId) {
        const storedTeacherAssessments: TeacherAssessment[] = JSON.parse(localStorage.getItem('assessments') || '[]');
        const foundAssessment = storedTeacherAssessments.find(a => a.id === assessmentId);

        const allStudentResults: StudentResult[] = JSON.parse(localStorage.getItem('student_results') || '[]');
        const foundStudentResult = allStudentResults.find(r => r.assessmentId === assessmentId && r.studentId === studentId);

        if (foundAssessment && foundStudentResult) {
            setAssessment(foundAssessment);
            setStudent(foundStudentResult);
        } else {
            console.warn("Assessment or student result not found in localStorage. Redirecting.");
            router.push('/teacher/dashboard');
        }
        setIsLoading(false);
    }
  }, [assessmentId, studentId, router]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assessment || !student) {
    return null; 
  }

  const noFeedbackMessage = "학생이 평가에 대해 남긴 피드백이 없습니다.";
  const hasFeedback = student.studentFeedbackSummary && student.studentFeedbackSummary !== noFeedbackMessage;
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
        <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary"/> 
                  {isDialogue ? "전체 대화 기록" : "학생 답변 내용"}
                </CardTitle>
                <CardDescription>
                  {isDialogue 
                    ? "학생과 AI의 전체 대화 내용과 학생 발화 녹음입니다." 
                    : "학생의 실제 답변 텍스트와 녹음 파일입니다."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {student.studentRecordingDataUri && (
                  <div>
                    <audio controls src={student.studentRecordingDataUri} className="w-full">
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
                <div className="text-sm p-4 bg-muted/50 rounded-lg font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {student.studentTranscript || "학생 답변이 기록되지 않았습니다."}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookText className="h-5 w-5 text-primary"/> 교과과정 비고 초안</CardTitle>
                <CardDescription>학생의 성과에 기반한 AI 생성 초안입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea readOnly value={student.curricularRemarks} className="h-48 bg-muted/50 font-mono text-sm whitespace-pre-wrap" />
                <Button className="w-full mt-4">
                  <Paperclip className="mr-2 h-4 w-4" /> 생활기록부에 저장
                </Button>
              </CardContent>
            </Card>
        </div>
        
        <div className="space-y-6">
            {student.pronunciationScore !== undefined && student.pronunciationFeedback && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary"/> 
                    발음 분석 결과
                  </CardTitle>
                  <CardDescription>학생의 발음 정확도와 AI의 상세 피드백입니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-full">
                            <div className="flex justify-between mb-1">
                                <span className="text-base font-medium text-primary">발음 점수</span>
                                <span className="text-sm font-medium text-primary">{student.pronunciationScore}%</span>
                            </div>
                            <Progress value={student.pronunciationScore} className="h-2" />
                        </div>
                    </div>
                    <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg whitespace-pre-wrap">
                        {student.pronunciationFeedback}
                    </div>
                </CardContent>
              </Card>
            )}

            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/> 선생님을 위한 조언</CardTitle>
                  <CardDescription>학생의 답변 분석에 기반한 AI 조언입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg whitespace-pre-wrap">
                    {student.teacherGuidance}
                  </div>
                </CardContent>
              </Card>

             <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary"/> 학생 피드백 요약</CardTitle>
                 <CardDescription>이 평가 활동에 대한 학생의 AI 요약 피드백입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg italic">
                    {hasFeedback ? student.studentFeedbackSummary : "피드백 없음"}
                 </div>
                <Button variant="outline" className="w-full mt-4" disabled={!hasFeedback}>
                  <Download className="mr-2 h-4 w-4" /> 전체 피드백 다운로드
                </Button>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  )
}
