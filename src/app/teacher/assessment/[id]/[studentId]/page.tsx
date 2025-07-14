
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Paperclip, Download, User, Activity, BookText, FileText, Target, Mic } from "lucide-react"
import { type TeacherAssessment, type StudentResult } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';

export default function StudentResultPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [studentResult, setStudentResult] = useState<StudentResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const resultId = Array.isArray(params.studentId) ? params.studentId[0] : params.studentId;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push('/');
        return;
    }

    if (assessmentId && resultId) {
        const fetchResultData = async () => {
            try {
                const resultRef = doc(db, "results", resultId);
                const resultSnap = await getDoc(resultRef);

                if (!resultSnap.exists() || resultSnap.data().teacherUid !== user.uid) {
                    notFound();
                    return;
                }
                const resultData = { id: resultSnap.id, ...resultSnap.data() } as StudentResult;
                setStudentResult(resultData);

                const assessmentRef = doc(db, "assessments", resultData.assessmentId);
                const assessmentSnap = await getDoc(assessmentRef);
                if (assessmentSnap.exists()) {
                    setAssessment({ id: assessmentSnap.id, ...assessmentSnap.data() } as TeacherAssessment);
                } else {
                    setAssessment({ id: resultData.assessmentId, title: resultData.assessmentTitle } as any);
                }
            } catch (error) {
                console.error("Error fetching result data:", error);
                notFound();
            } finally {
                setIsLoading(false);
            }
        };

        fetchResultData();
    }
  }, [assessmentId, resultId, user, authLoading, router]);

  const handleDownloadReport = () => {
    if (!studentResult || !assessment) return;

    const docPDF = new jsPDF();
    const margin = 15;
    let finalY = 20;

    // Use a basic font that supports English characters.
    docPDF.setFont("Helvetica");

    docPDF.setFontSize(22);
    docPDF.text('Student Report', margin, finalY);
    finalY += 10;
    
    docPDF.setDrawColor(200, 200, 200);
    docPDF.line(margin, finalY, 210 - margin, finalY);
    finalY += 10;
    
    docPDF.setFontSize(12);
    
    const isDialogue = assessment.assessmentType === 'dialogue';

    const bodyData = [
      ['Student Name', studentResult.name],
      ['Assessment', assessment.title],
      ['Type', isDialogue ? 'Dialogue with AI' : 'Monologue'],
      ['Date', studentResult.date],
      ['Content Score', `${studentResult.score}%`],
      ['Pronunciation Score', `${studentResult.pronunciationScore ?? 0}%`],
      { content: 'AI Feedback (for Student)', styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      [studentResult.aiFeedback],
      { content: 'Pronunciation Analysis', styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      [studentResult.pronunciationFeedback || 'N/A'],
      { content: `Full ${isDialogue ? 'Conversation' : 'Response'} Transcript`, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      [studentResult.studentTranscript || 'No transcript available'],
      { content: 'Draft Curricular Remarks', styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      [studentResult.curricularRemarks],
      { content: 'Guidance for Teacher', styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      [studentResult.teacherGuidance],
      { content: 'Student Feedback Summary', styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
      [studentResult.studentFeedbackSummary],
    ];

    autoTable(docPDF, {
      startY: finalY,
      head: [['Item', 'Details']],
      body: bodyData,
      theme: 'grid',
      styles: {
        cellPadding: 3,
        fontSize: 10,
      },
      headStyles: {
        fontStyle: 'bold',
        fillColor: [52, 152, 219],
        textColor: 255,
      },
      didParseCell: function(data) {
        if (typeof data.cell.raw === 'object' && !Array.isArray(data.cell.raw)) {
          data.cell.styles.halign = 'center';
          data.cell.text = (data.cell.raw as any).content;
          data.cell.colSpan = 2;
        }
        if (Array.isArray(data.cell.raw) && data.cell.raw.length === 1) {
            data.cell.colSpan = 2;
        }
      }
    });

    docPDF.save(`${studentResult.name}_${assessment.title}_Report.pdf`);
  };
  
  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assessment || !studentResult) {
    return null; 
  }

  const noFeedbackMessage = "학생이 평가에 대해 남긴 피드백이 없습니다.";
  const hasFeedback = studentResult.studentFeedbackSummary && studentResult.studentFeedbackSummary !== noFeedbackMessage;
  const isDialogue = assessment.assessmentType === 'dialogue';

  return (
    <div className="space-y-6">
       <Card>
          <CardHeader className="flex-row items-center gap-4 space-y-0">
             <Avatar className="h-16 w-16">
                <AvatarImage src={studentResult.avatarUrl} alt={studentResult.name} data-ai-hint="person portrait" />
                <AvatarFallback>{studentResult.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-grow">
              <CardTitle className="text-2xl">{studentResult.name} 학생 결과</CardTitle>
              <CardDescription>평가: <span className="font-semibold">{assessment.title}</span></CardDescription>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownloadReport}>
                    <Download className="mr-2 h-4 w-4" />
                    리포트 다운로드
                </Button>
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
                {studentResult.studentRecordingDataUri && (
                  <div className="flex flex-col gap-2">
                    <audio controls src={studentResult.studentRecordingDataUri} className="w-full">
                      Your browser does not support the audio element.
                    </audio>
                     <a href={studentResult.studentRecordingDataUri} download={`${studentResult.name}_${assessment.title}_녹음.webm`} className="w-full">
                        <Button variant="secondary" className="w-full">
                            <Mic className="mr-2 h-4 w-4" />
                            음성 파일 다운로드
                        </Button>
                    </a>
                  </div>
                )}
                <div className="text-sm p-4 bg-muted/50 rounded-lg font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {studentResult.studentTranscript || "학생 답변이 기록되지 않았습니다."}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookText className="h-5 w-5 text-primary"/> 교과과정 비고 초안</CardTitle>
                <CardDescription>학생의 성과에 기반한 AI 생성 초안입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea readOnly value={studentResult.curricularRemarks} className="h-48 bg-muted/50 font-mono text-sm whitespace-pre-wrap" />
                <Button className="w-full mt-4">
                  <Paperclip className="mr-2 h-4 w-4" /> 생활기록부에 저장
                </Button>
              </CardContent>
            </Card>
        </div>
        
        <div className="space-y-6">
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
                              <span className="text-sm font-medium text-primary">{studentResult.pronunciationScore ?? 0}%</span>
                          </div>
                          <Progress value={studentResult.pronunciationScore} className="h-2" />
                      </div>
                  </div>
                  <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg whitespace-pre-wrap">
                      {studentResult.pronunciationFeedback || "발음 분석 결과가 없습니다."}
                  </div>
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/> 선생님을 위한 조언</CardTitle>
                  <CardDescription>학생의 답변 분석에 기반한 AI 조언입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg whitespace-pre-wrap">
                    {studentResult.teacherGuidance}
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
                    {hasFeedback ? studentResult.studentFeedbackSummary : "피드백 없음"}
                 </div>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
