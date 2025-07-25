
"use client";

import { FreeTalkFeedbackView } from "./free-talk-feedback-view";
import { GrowthView } from "./growth-view";
import { useRouter, notFound, useSearchParams } from 'next/navigation';
import { useEffect, useState } from "react";
import { type StudentResult, type TeacherAssessment } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';

export default function FreeTalkResultsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const [results, setResults] = useState<StudentResult[]>([]);
    const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
    const [status, setStatus] = useState<"loading" | "completed">("loading");
    
    const assessmentId = searchParams.get('id');

    useEffect(() => {
        if(authLoading || !user || !assessmentId) return;

        if (!db) {
            toast({
                title: "설정 오류",
                description: "Firebase 데이터베이스가 설정되지 않았습니다. 결과를 볼 수 없습니다.",
                variant: "destructive",
            });
            setStatus("completed"); // To avoid infinite loading
            setResults([]);
            return;
        }
        
        const fetchResults = async () => {
            try {
                // Simplified query
                const q = query(
                    collection(db, "results"),
                    where("assessmentId", "==", assessmentId),
                    where("studentId", "==", user.uid)
                );

                const resultsSnapshot = await getDocs(q);
                
                // Filter and sort client-side
                const dbResults: StudentResult[] = resultsSnapshot.docs
                    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
                    .filter(result => result.status === '채점 완료')
                    .sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0));

                if (dbResults.length === 0) {
                    router.replace(`/student/dashboard`); 
                    return;
                }

                setResults(dbResults);
                
                const assessmentRef = doc(db, 'assessments', assessmentId);
                const assessmentSnap = await getDoc(assessmentRef);
                if (assessmentSnap.exists()) {
                    setAssessment({id: assessmentSnap.id, ...assessmentSnap.data()} as TeacherAssessment);
                } else {
                    notFound();
                    return;
                }
                setStatus("completed");
            } catch (err) {
                console.error("[Dialogue Results Page] Error fetching results:", err);
                router.replace(`/student/dashboard`); 
            }
        };
    
        fetchResults();

    }, [assessmentId, user, authLoading, router, toast]);


    if (status === "loading" || authLoading) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 h-96">
                 <Loader2 className="h-12 w-12 animate-spin text-primary" />
                 <p className="mt-4 text-muted-foreground">결과를 불러오는 중...</p>
            </div>
        );
    }
  
    if (status === 'completed' && assessment) {
      if (results.length === 0) {
        return (
           <div className="text-center p-8">
               <p>이 평가에 대한 제출된 결과가 없습니다. 평가를 먼저 완료해주세요.</p>
               <Button onClick={() => router.push(`/student/assessment/free-talk?id=${assessment.id}`)} className="mt-4">평가 시작하기</Button>
           </div>
        );
      }
      if (results.length === 1) {
        return <FreeTalkFeedbackView result={results[0]} assessment={assessment} isLatestAttempt={true} />;
      }
      if (results.length > 1) {
        const attemptNumber = searchParams.get('attempt');
        return <GrowthView results={results} assessment={assessment} defaultTab={`attempt-${attemptNumber || results.length}`} />;
      }
    }

    return null;
}
