
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Paperclip, Download, User, Activity, BookText, FileText, Target, Mic } from "lucide-react"
import { type TeacherAssessment, type StudentResult } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { NanumGothicFont } from '@/lib/fonts/noto-sans-kr-for-jspdf';


// This is the new, teacher-specific view. It does not reuse student components.

export default function TeacherStudentResultView() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [studentResult, setStudentResult] = useState<StudentResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const studentId = Array.isArray(params.studentId) ? params.studentId[0] : params.studentId;

  const fetchResultData = useCallback(async () => {
    if (!user || !studentId || !assessmentId) return;
    setIsLoading(true);
    try {
        // Fetch all results for this student and assessment to get the latest one
        const resultsQuery = query(
            collection(db, "results"),
            where("assessmentId", "==", assessmentId),
            where("studentId", "==", studentId)
        );
        const resultsSnap = await getDocs(resultsQuery);
        if (resultsSnap.empty) {
            toast({ title: "결과 없음", description: "해당 학생의 평가 결과가 없습니다.", variant: "destructive" });
            router.push(`/teacher/assessment/${assessmentId}`);
            return;
        }

        const allResults = resultsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as StudentResult))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // Newest first

        const latestResult = allResults[0];
        setStudentResult(latestResult);

        if (latestResult.teacherUid !== user.uid) {
            toast({ title: "권한 없음", description: "이 결과에 접근할 권한이 없습니다.", variant: "destructive" });
            notFound();
            return;
        }

        const assessmentRef = doc(db, "assessments", latestResult.assessmentId);
        const assessmentSnap = await getDoc(assessmentRef);
        if (assessmentSnap.exists()) {
            setAssessment({ id: assessmentSnap.id, ...assessmentSnap.data() } as TeacherAssessment);
        } else {
            setAssessment({ id: latestResult.assessmentId, title: latestResult.assessmentTitle } as any);
        }
    } catch (error) {
        console.error("Error fetching result data:", error);
        toast({ title: "오류", description: "결과를 불러오는 중 오류가 발생했습니다.", variant: "destructive" });
        notFound();
    } finally {
        setIsLoading(false);
    }
  }, [studentId, assessmentId, user, toast, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push('/');
        return;
    }
    fetchResultData();
  }, [user, authLoading, router, fetchResultData]);

  const handleDownloadReport = async () => {
    if (!studentResult || !assessment) return;
    setIsDownloading(true);
    toast({ title: "리포트 생성 중...", description: "PDF 파일을 준비하고 있습니다." });

    try {
        const docPDF = new jsPDF();
        
        docPDF.addFileToVFS("NanumGothic.ttf", NanumGothicFont);
        docPDF.addFont("NanumGothic.ttf", "NanumGothic", "normal");
        docPDF.setFont("NanumGothic");

        const margin = 15;
        docPDF.setFontSize(22);
        docPDF.text('학생 리포트', margin, 20);
        docPDF.setFontSize(12);
        docPDF.setTextColor(100);
        docPDF.text(`${studentResult.name} 학생 - ${assessment.title}`, margin, 30);

        const isDialogue = assessment.assessmentType === 'dialogue';
        autoTable(docPDF, {
            startY: 40,
            head: [['항목', '세부 내용']],
            body: [
                ['학생 이름', studentResult.name],
                ['평가명', assessment.title],
                ['유형', isDialogue ? 'AI와 대화하기' : '혼자 말하기'],
                ['제출일', studentResult.date],
                ['내용 점수', `${studentResult.contentScore ?? 0}%`],
                ['발음 점수', `${studentResult.pronunciationScore ?? 0}%`],
            ],
            theme: 'grid',
            styles: { font: "NanumGothic", fontSize: 10 },
            headStyles: { fontStyle: 'bold', fillColor: [41, 128, 185], textColor: 255 },
        });

        let finalY = (docPDF as any).lastAutoTable.finalY || 100;
        const addSection = (title: string, content: string | undefined, startY: number): number => {
            if (!content) return startY;
            docPDF.setFontSize(14);
            docPDF.setTextColor(0);
            docPDF.text(title, margin, startY);
            docPDF.setFontSize(10);
            docPDF.setTextColor(100);
            const splitContent = docPDF.splitTextToSize(content, 180);
            docPDF.text(splitContent, margin, startY + 8);
            return startY + docPDF.getTextDimensions(splitContent).h + 15;
        };

        let currentY = finalY + 10;
        currentY = addSection('AI 피드백 (학생용)', studentResult.aiFeedback, currentY);
        currentY = addSection('발음 분석', studentResult.pronunciationFeedback, currentY);
        currentY = addSection(isDialogue ? '전체 대화 기록' : '답변 내용', studentResult.studentTranscript, currentY);
        currentY = addSection('교과과정 비고 (개별)', studentResult.curricularRemarks, currentY);
        currentY = addSection('교과과정 비고 (종합)', studentResult.growthCurricularRemarks, currentY);
        currentY = addSection('선생님을 위한 조언 (종합)', studentResult.growthTeacherGuidance, currentY);
        addSection('학생 피드백 요약', studentResult.studentFeedbackSummary, currentY);
        
        docPDF.save(`report_${studentResult.studentId}_${assessmentId}.pdf`);
        toast({ title: "성공", description: "리포트 다운로드가 시작되었습니다." });
    } catch (error) {
        console.error("PDF 생성 오류:", error);
        toast({ title: "오류", description: "PDF 리포트 생성에 실패했습니다.", variant: "destructive" });
    } finally {
        setIsDownloading(false);
    }
  };
  
  const handleSaveCurricularRemarks = async () => {
    if (!studentResult) return;
    setIsSaving(true);
    try {
        const resultRef = doc(db, "results", studentResult.id);
        await updateDoc(resultRef, {
            curricularRemarks: studentResult.curricularRemarks,
            growthCurricularRemarks: studentResult.growthCurricularRemarks
        });
        toast({ title: "저장 완료", description: "교과과정 비고가 저장되었습니다." });
    } catch (error) {
        console.error("비고 저장 오류:", error);
        toast({ title: "저장 실패", description: "비고 저장 중 오류 발생.", variant: "destructive"});
    } finally {
        setIsSaving(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assessment || !studentResult) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>결과 없음</CardTitle>
                <CardDescription>이 학생의 평가 결과를 찾을 수 없습니다.</CardDescription>
            </CardHeader>
        </Card>
    );
  }

  const isDialogue = assessment.assessmentType === 'dialogue';
  const hasFeedback = studentResult.studentFeedbackSummary && studentResult.studentFeedbackSummary !== "학생이 평가에 대해 남긴 피드백이 없습니다.";
  const finalRemarks = studentResult.growthCurricularRemarks || studentResult.curricularRemarks || "";

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
            <Button variant="outline" onClick={handleDownloadReport} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {isDownloading ? "생성 중..." : "리포트 다운로드"}
            </Button>
          </CardHeader>
       </Card>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary"/>{isDialogue ? "대화 기록" : "답변 내용"}</CardTitle>
                <CardDescription>{isDialogue ? "학생과 AI의 전체 대화 내용입니다." : "학생의 실제 답변 텍스트입니다."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {studentResult.studentRecordingUrl && (
                  <audio controls src={studentResult.studentRecordingUrl} className="w-full">오디오 지원 안됨</audio>
                )}
                <div className="text-sm p-4 bg-muted/50 rounded-lg font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {studentResult.studentTranscript || "학생 답변이 기록되지 않았습니다."}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookText className="h-5 w-5 text-primary"/>교과과정 비고 (종합)</CardTitle>
                <CardDescription>AI 생성 초안을 수정하고 저장할 수 있습니다. (최종 시도 기준)</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea 
                  value={finalRemarks} 
                  onChange={(e) => setStudentResult({...studentResult, growthCurricularRemarks: e.target.value, curricularRemarks: e.target.value })}
                  className="h-48 bg-background font-mono text-sm whitespace-pre-wrap" />
                <Button className="w-full mt-4" onClick={handleSaveCurricularRemarks} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
                  {isSaving ? "저장 중..." : "생활기록부에 저장"}
                </Button>
              </CardContent>
            </Card>
        </div>
        <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary"/>성능 분석 결과</CardTitle>
                <CardDescription>학생의 내용 및 발음 정확도와 AI의 상세 피드백입니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="space-y-2">
                      <div className="w-full">
                          <div className="flex justify-between mb-1"><span className="text-base font-medium text-primary">내용 점수</span><span className="text-sm font-medium text-primary">{studentResult.contentScore ?? 0}%</span></div>
                          <Progress value={studentResult.contentScore} className="h-2" />
                      </div>
                      <div className="w-full">
                          <div className="flex justify-between mb-1"><span className="text-base font-medium text-primary">발음 점수</span><span className="text-sm font-medium text-primary">{studentResult.pronunciationScore ?? 0}%</span></div>
                          <Progress value={studentResult.pronunciationScore} className="h-2" />
                      </div>
                  </div>
                  <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg whitespace-pre-wrap max-h-48 overflow-auto">{studentResult.aiFeedback || "AI 피드백이 없습니다."}</div>
              </CardContent>
            </Card>
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/>선생님을 위한 조언 (종합)</CardTitle>
                  <CardDescription>학생의 모든 시도를 분석한 AI 조언입니다.</CardDescription>
                </Header>
                <CardContent>
                  <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg whitespace-pre-wrap">{studentResult.growthTeacherGuidance || "종합 조언이 없습니다. 학생이 1회만 시도했거나, AI 분석 중 오류가 발생했을 수 있습니다."}</div>
                </CardContent>
              </Card>
             <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary"/>학생 피드백 요약</CardTitle>
                 <CardDescription>이 평가 활동에 대한 학생의 AI 요약 피드백입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg italic">{hasFeedback ? studentResult.studentFeedbackSummary : "피드백 없음"}</div>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
