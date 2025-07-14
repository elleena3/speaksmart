
"use client";

import { FeedbackView } from "./feedback-view"
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import { type StudentResult } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, onSnapshot, doc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AssessmentResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [result, setResult] = useState<StudentResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/');
      return;
    }

    if (id === 'free-talk') {
      router.push('/student/assessment/free-talk/results');
      return;
    }

    const q = query(
      collection(db, "results"),
      where("assessmentId", "==", id),
      where("studentId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const resultData = { id: doc.id, ...doc.data() } as StudentResult;
        setResult(resultData);

        if (resultData.status === '오류') {
          setError(resultData.aiFeedback || "분석 중 오류가 발생했습니다.");
          setIsLoading(false);
        } else if (resultData.status === '채점 완료') {
          setIsLoading(false);
          setError(null);
        } else {
          setIsLoading(true); // Still grading
        }
      } else {
        // This case might happen if the doc is not created yet, or no results exist.
        // It might be better to show a "not found" or "not started" message.
        setIsLoading(false);
      }
    }, (err) => {
      console.error("Error fetching result with onSnapshot: ", err);
      setError("결과를 불러오는 중 오류가 발생했습니다.");
      setIsLoading(false);
    });

    return () => unsubscribe(); // Cleanup subscription on unmount

  }, [id, user, authLoading, router]);

  if (isLoading || authLoading) {
    return (
      <Card className="flex flex-col items-center justify-center text-center p-8 h-80">
        <CardHeader>
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <CardTitle>AI가 채점 중입니다</CardTitle>
          <CardDescription>분석이 완료되면 이 페이지가 자동으로 새로고침됩니다. 잠시만 기다려주세요.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  if (error) {
    return (
        <Card className="flex flex-col items-center justify-center text-center p-8 h-80 bg-destructive/10 border-destructive">
            <CardHeader>
                <CardTitle className="text-destructive">분석 오류</CardTitle>
                <CardDescription className="text-destructive-foreground">{error}</CardDescription>
            </CardHeader>
        </Card>
    );
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
