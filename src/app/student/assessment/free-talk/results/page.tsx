
"use client";

import { FreeTalkFeedbackView } from "./free-talk-feedback-view";
import { GrowthView } from "../../[id]/results/growth-view";
import { useRouter, notFound, useSearchParams } from 'next/navigation';
import { useEffect, useState } from "react";
import { type StudentResult, type TeacherAssessment } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";

const SESSION_STORAGE_KEY = 'freeTalkSessionData';

export default function FreeTalkResultsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const [results, setResults] = useState<StudentResult[]>([]);
    const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
    const [status, setStatus] = useState<"loading" | "completed">("loading");
    
    const assessmentId = searchParams.get('id');

    useEffect(() => {
        if(authLoading || !user || !assessmentId) return;

        // If processing page redirects here, it won't have sessionStorage data.
        // This will now only fetch completed data.
        const sessionDataRaw = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (sessionDataRaw) {
            router.replace(`/student/assessment/free-talk/processing?id=${assessmentId}`);
            return;
        }
        
        const fetchResults = async () => {
            try {
                const q = query(
                    collection(db, "results"),
                    where("assessmentId", "==", assessmentId),
                    where("studentId", "==", user.uid),
                    where("status", "==", "채점 완료")
                );

                const resultsSnapshot = await getDocs(q);
                if (resultsSnapshot.empty) {
                    // This can happen if user refreshes processing page, then comes here.
                    // Guide them to dashboard as there's no result to show yet.
                    router.replace(`/student/dashboard`); 
                    return;
                }

                const dbResults: StudentResult[] = resultsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                dbResults.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
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

    }, [assessmentId, user, authLoading, router]);


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
