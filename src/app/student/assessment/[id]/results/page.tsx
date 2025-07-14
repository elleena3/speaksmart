
"use client";

import { FeedbackView } from "./feedback-view"
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import { type StudentResult, type ResultStatus } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Loader2, UploadCloud, FileText, BrainCircuit, BookCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const statusDetails: Record<ResultStatus, { icon: React.ElementType, text: string }> = {
    "업로드 중": { icon: UploadCloud, text: "오디오 파일 업로드 중..." },
    "텍스트 변환 중": { icon: FileText, text: "음성을 텍스트로 변환 중..." },
    "분석 중": { icon: BrainCircuit, text: "AI가 답변을 분석하고 있습니다." },
    "리포트 생성 중": { icon: BookCheck, text: "최종 리포트를 생성하고 있습니다." },
    "채점 중": { icon: Loader2, text: "AI가 채점 중입니다. 잠시만 기다려주세요." }, // Fallback
    "채점 완료": { icon: Loader2, text: "채점 완료!" },
    "오류": { icon: Loader2, text: "오류 발생" },
};

export default function AssessmentResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [result, setResult] = useState<StudentResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<ResultStatus>("채점 중");
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
        setCurrentStatus(resultData.status);

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
        // It's better to show that it's still grading.
        setIsLoading(true);
        setCurrentStatus("채점 중");
      }
    }, (err) => {
      console.error("Error fetching result with onSnapshot: ", err);
      setError("결과를 불러오는 중 오류가 발생했습니다.");
      setIsLoading(false);
    });

    return () => unsubscribe(); // Cleanup subscription on unmount

  }, [id, user, authLoading, router]);

  if (isLoading || authLoading) {
    const { icon: Icon, text } = statusDetails[currentStatus] || statusDetails["채점 중"];
    return (
      <Card className="flex flex-col items-center justify-center text-center p-8 h-80">
        <CardHeader>
          <Icon className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <CardTitle>AI 분석 진행 중</CardTitle>
          <CardDescription>{text}</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">분석이 완료되면 이 페이지가 자동으로 새로고침됩니다.</p>
        </CardContent>
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
