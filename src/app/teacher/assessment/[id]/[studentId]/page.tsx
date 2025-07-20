
"use client";

import { useEffect, useState, useCallback } from "react";
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
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { summarizeStudentFeedback } from "@/ai/flows/summarize-student-feedback";
import ReactMarkdown from 'react-markdown';
import remarkGfm from "remark-gfm";
import { FreeTalkFeedbackView } from "@/app/student/assessment/free-talk/results/free-talk-feedback-view";
import { FeedbackView } from "@/app/student/assessment/[id]/results/feedback-view";
import { GrowthView } from "@/app/student/assessment/[id]/results/growth-view";


export default function StudentResultPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);
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
        const assessmentRef = doc(db, "assessments", assessmentId);
        const assessmentSnap = await getDoc(assessmentRef);
        if (!assessmentSnap.exists() || assessmentSnap.data().uid !== user.uid) {
            toast({ title: "오류", description: "평가를 찾을 수 없거나 접근 권한이 없습니다.", variant: "destructive" });
            notFound();
            return;
        }
        setAssessment({ id: assessmentSnap.id, ...assessmentSnap.data() } as TeacherAssessment);
        
        const q = query(
            collection(db, "results"),
            where("assessmentId", "==", assessmentId),
            where("studentId", "==", studentId),
            where("status", "==", "채점 완료"),
            orderBy("createdAt", "asc")
        );
        const resultsSnapshot = await getDocs(q);

        if (resultsSnapshot.empty) {
            toast({ title: "결과 없음", description: "해당 학생의 완료된 평가 결과가 없습니다.", variant: "destructive" });
            notFound();
            return;
        }

        const fetchedResults = resultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentResult));

        // Check for summaries on the latest result
        const latestResult = fetchedResults[fetchedResults.length - 1];
        if (latestResult.studentRawFeedback && !latestResult.studentFeedbackSummary) {
          try {
            toast({ title: "학생 피드백 요약 중...", description: "AI가 학생의 피드백을 요약하고 있습니다." });
            const { summary } = await summarizeStudentFeedback({ feedbackText: latestResult.studentRawFeedback });
            await updateDoc(doc(db, "results", latestResult.id), { studentFeedbackSummary: summary });
            latestResult.studentFeedbackSummary = summary;
            toast({ title: "요약 완료", description: "학생 피드백 요약이 완료되었습니다." });
          } catch(e) {
            console.error("Error summarizing on the fly:", e);
            latestResult.studentFeedbackSummary = "AI 요약 중 오류가 발생했습니다.";
          }
        }
        
        setResults(fetchedResults);
    } catch (error) {
        console.error("Error fetching result data:", error);
        toast({ title: "오류", description: "결과를 불러오는 중 오류가 발생했습니다.", variant: "destructive" });
        notFound();
    } finally {
        setIsLoading(false);
    }
  }, [studentId, assessmentId, user, toast, notFound]);


  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push('/');
        return;
    }

    if (assessmentId && studentId) {
      fetchResultData();
    }
  }, [assessmentId, studentId, user, authLoading, router, fetchResultData]);
  
  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assessment || results.length === 0) {
    return null; 
  }
  
  const latestResult = results[results.length - 1];

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader className="flex-row items-center gap-4 space-y-0">
                <Avatar className="h-16 w-16">
                    <AvatarImage src={latestResult.avatarUrl} alt={latestResult.name} data-ai-hint="person portrait" />
                    <AvatarFallback>{latestResult.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-grow">
                <CardTitle className="text-2xl">{latestResult.name} 학생 결과</CardTitle>
                <CardDescription>평가: <span className="font-semibold">{assessment.title}</span> ({results.length}회 응시)</CardDescription>
                </div>
            </CardHeader>
        </Card>

        {results.length === 1 && (
             assessment.assessmentType === 'dialogue' ? 
             <FreeTalkFeedbackView result={latestResult} assessment={assessment} isLatestAttempt={true} /> : 
             <FeedbackView result={latestResult} assessment={assessment} isLatestAttempt={true} />
        )}

        {results.length > 1 && (
            <GrowthView results={results} assessment={assessment} />
        )}

    </div>
  );
}
