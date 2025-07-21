
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { type TeacherAssessment, type StudentResult } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { FeedbackView } from "@/app/student/assessment/[id]/results/feedback-view";
import { GrowthView as MonologueGrowthView } from "@/app/student/assessment/[id]/results/growth-view";
import { GrowthView as DialogueGrowthView } from "@/app/student/assessment/free-talk/results/growth-view";


export default function TeacherStudentResultView() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
        const assessmentData = { id: assessmentSnap.id, ...assessmentSnap.data() } as TeacherAssessment;
        setAssessment(assessmentData);

        const resultsQuery = query(
            collection(db, "results"),
            where("assessmentId", "==", assessmentId),
            where("studentId", "==", studentId),
            where("status", "==", "채점 완료"),
            orderBy("createdAt", "asc")
        );
        const resultsSnap = await getDocs(resultsQuery);

        if (resultsSnap.empty) {
            toast({ title: "결과 없음", description: "해당 학생의 완료된 평가 결과가 없습니다.", variant: "destructive" });
            router.push(`/teacher/assessment/${assessmentId}`);
            return;
        }
        
        const studentResults = resultsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentResult));
        setResults(studentResults);

    } catch (error) {
        console.error("Error fetching result data:", error);
        toast({ title: "오류", description: "결과를 불러오는 중 오류가 발생했습니다.", variant: "destructive" });
        notFound();
    } finally {
        setIsLoading(false);
    }
  }, [studentId, assessmentId, user, toast, router, notFound]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push('/');
        return;
    }
    fetchResultData();
  }, [user, authLoading, router, fetchResultData]);
  

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

  if (results.length === 1) {
    return <FeedbackView result={latestResult} assessment={assessment} isLatestAttempt={true} />;
  }

  if (assessment.assessmentType === 'dialogue') {
      return <DialogueGrowthView results={results} assessment={assessment} defaultTab={`attempt-${results.length}`} />;
  }
  
  return <MonologueGrowthView results={results} assessment={assessment} defaultTab={`attempt-${results.length}`} />;
}
