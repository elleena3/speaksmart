
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2 } from "lucide-react"
import { type TeacherAssessment, type StudentResult } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, where, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
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
        
        const resultsCollection = collection(db, "results");
        const q = query(
            resultsCollection,
            where("assessmentId", "==", assessmentId),
            where("studentId", "==", studentId),
            where("status", "==", "채점 완료"),
            orderBy("createdAt", "asc")
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
             toast({ title: "결과 없음", description: "해당 학생의 평가 결과가 없습니다.", variant: "destructive" });
             setResults([]);
        } else {
             const fetchedResults = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentResult));
             setResults(fetchedResults);
        }

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
    return (
        <Card>
            <CardHeader>
                <CardTitle>결과 없음</CardTitle>
                <CardDescription>이 학생은 아직 이 평가를 완료하지 않았습니다.</CardDescription>
            </CardHeader>
        </Card>
    )
  }
  
  const studentInfo = results[0];

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader className="flex-row items-center gap-4 space-y-0">
                <Avatar className="h-16 w-16">
                    <AvatarImage src={studentInfo.avatarUrl} alt={studentInfo.name} data-ai-hint="person portrait" />
                    <AvatarFallback>{studentInfo.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-grow">
                <CardTitle className="text-2xl">{studentInfo.name} 학생 결과</CardTitle>
                <CardDescription>평가: <span className="font-semibold">{assessment.title}</span></CardDescription>
                </div>
            </CardHeader>
        </Card>

        {results.length > 1 ? (
           <GrowthView results={results} assessment={assessment} />
        ) : assessment.assessmentType === 'dialogue' ? (
            <FreeTalkFeedbackView result={results[0]} assessment={assessment} isLatestAttempt={true} />
        ) : (
            <FeedbackView result={results[0]} assessment={assessment} isLatestAttempt={true} />
        )}
    </div>
  );
}
