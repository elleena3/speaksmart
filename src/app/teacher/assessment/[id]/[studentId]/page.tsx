
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2 } from "lucide-react"
import { type TeacherAssessment, type StudentResult } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { FreeTalkFeedbackView } from "@/app/student/assessment/free-talk/results/free-talk-feedback-view";
import { FeedbackView } from "@/app/student/assessment/[id]/results/feedback-view";
import { GrowthView } from "@/app/student/assessment/[id]/results/growth-view";


export default function StudentResultPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [result, setResult] = useState<StudentResult | null>(null);
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
        
        const resultsQuery = collection(db, "results");
        const q = where("assessmentId", "==", assessmentId);
        const q2 = where("studentId", "==", studentId);
        const querySnapshot = await getDocs(collection(db, "results"));
        
        let foundResult: StudentResult | null = null;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.assessmentId === assessmentId && data.studentId === studentId) {
                foundResult = { id: doc.id, ...data } as StudentResult;
            }
        });
        
        if (foundResult) {
            setResult(foundResult);
        } else {
             toast({ title: "결과 없음", description: "해당 학생의 평가 결과가 없습니다.", variant: "destructive" });
             // notFound();
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

  if (!assessment || !result) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>결과 없음</CardTitle>
                <CardDescription>이 학생은 아직 이 평가를 완료하지 않았습니다.</CardDescription>
            </CardHeader>
        </Card>
    )
  }

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader className="flex-row items-center gap-4 space-y-0">
                <Avatar className="h-16 w-16">
                    <AvatarImage src={result.avatarUrl} alt={result.name} data-ai-hint="person portrait" />
                    <AvatarFallback>{result.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-grow">
                <CardTitle className="text-2xl">{result.name} 학생 결과</CardTitle>
                <CardDescription>평가: <span className="font-semibold">{assessment.title}</span></CardDescription>
                </div>
            </CardHeader>
        </Card>

        {assessment.assessmentType === 'dialogue' ? 
            <FreeTalkFeedbackView result={result} assessment={assessment} isLatestAttempt={true} /> : 
            <FeedbackView result={result} assessment={assessment} isLatestAttempt={true} />
        }
    </div>
  );
}
