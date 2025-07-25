
"use client";

import { FeedbackView } from "./feedback-view";
import { GrowthView } from "./growth-view";
import { useParams, useRouter, notFound, useSearchParams } from 'next/navigation';
import { useEffect, useState } from "react";
import { type StudentResult, type TeacherAssessment } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import { useToast } from '@/hooks/use-toast';

export default function AssessmentResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [results, setResults] = useState<StudentResult[]>([]);
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [status, setStatus] = useState<"loading" | "completed">("loading");
  
  useEffect(() => {
    if (authLoading || !user || !id) return;
    
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
        // Simplified query to avoid composite index requirement
        const q = query(
            collection(db, "results"),
            where("assessmentId", "==", id),
            where("studentId", "==", user.uid)
        );

        const resultsSnapshot = await getDocs(q);
        
        // Filter and sort in client-side code
        const dbResults: StudentResult[] = resultsSnapshot.docs
            .map((doc: any) => ({ id: doc.id, ...doc.data() }))
            .filter((result: StudentResult) => result.status === "채점 완료")
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); // Sort ascending (oldest first)

        if (dbResults.length === 0) {
          console.warn("No completed results found for this assessment.");
          router.replace(`/student/dashboard`); 
          return;
        }
        
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

  }, [id, user, authLoading, router, toast]);
  
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
         </div>
      );
    }
    
    if (results.length === 1) {
      return <FeedbackView result={results[0]} assessment={assessment} isLatestAttempt={true} />;
    }

    if (results.length > 1) {
      const attemptNumber = searchParams.get('attempt');
      // The GrowthView component still exists but will use the old logic for now
      return <GrowthView results={results} assessment={assessment} defaultTab={`attempt-${attemptNumber || results.length}`} />;
    }
  }

  return null;
}
