
"use client";

import { GrowthView } from "./growth-view";
import { useParams, useRouter, notFound, useSearchParams } from 'next/navigation';
import { useEffect, useState } from "react";
import { type StudentResult, type TeacherAssessment } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { FeedbackView } from "./feedback-view";

export default function AssessmentResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [results, setResults] = useState<StudentResult[]>([]);
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [status, setStatus] = useState<"loading" | "completed">("loading");
  
  useEffect(() => {
    if (authLoading || !user || !id) return;
    
    const fetchResults = async () => {
      try {
        const q = query(
            collection(db, "results"),
            where("assessmentId", "==", id),
            where("studentId", "==", user.uid),
            where("status", "==", "채점 완료")
        );

        const resultsSnapshot = await getDocs(q);

        if (resultsSnapshot.empty) {
          console.warn("No completed results found for this assessment.");
          router.replace(`/student/dashboard`); 
          return;
        }

        const dbResults: StudentResult[] = resultsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        dbResults.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        setResults(dbResults);
        
        const assessmentRef = doc(db, 'assessments', id as string);
        const assessmentSnap = await getDoc(assessmentRef);
        if (assessmentSnap.exists()) {
            setAssessment({id: assessmentSnap.id, ...assessmentSnap.data()} as TeacherAssessment);
        } else {
            notFound();
            return;
        }

        setStatus("completed");
      } catch (err) {
          console.error("[Results Page] Error fetching results:", err);
          router.replace(`/student/dashboard`); 
      }
    };
    
    fetchResults();

  }, [id, user, authLoading, router]);
  
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
             <p>이 평가에 대한 완료된 결과가 없습니다.</p>
             <Button onClick={() => router.push(`/student/assessment/${id}`)} className="mt-4">평가 시작하기</Button>
         </div>
      );
    }
    
    if (results.length === 1) {
      return <FeedbackView result={results[0]} assessment={assessment} isLatestAttempt={true} />;
    }

    if (results.length > 1) {
      const attemptNumber = searchParams.get('attempt');
      return <GrowthView results={results} assessment={assessment} defaultTab={`attempt-${attemptNumber || results.length}`} />;
    }
  }

  return null;
}
