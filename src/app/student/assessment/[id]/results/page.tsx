
"use client";

import { FeedbackView } from "./feedback-view"
import { redirect, useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import { type StudentResult } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Loader2 } from "lucide-react";

export default function AssessmentResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [result, setResult] = useState<StudentResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push('/');
        return;
    }
    
    if (id === 'free-talk') {
      redirect('/student/assessment/free-talk/results');
      return;
    }
    
    const fetchResult = async () => {
        const q = query(
            collection(db, "results"), 
            where("assessmentId", "==", id), 
            where("studentId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            setResult({ id: doc.id, ...doc.data() } as StudentResult);
        }
        setIsLoading(false);
    }

    fetchResult();
  }, [id, user, authLoading, router]);


  if (isLoading || authLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>;
  }
  
  if (!result) {
     return (
        <div className="text-center p-8">
            <p>평가 결과를 찾을 수 없습니다.</p>
            <p className="text-sm text-muted-foreground">평가를 먼저 완료해주세요.</p>
        </div>
     );
  }

  return (
    <FeedbackView result={result} />
  )
}
