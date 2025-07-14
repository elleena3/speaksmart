
"use client";

import { FeedbackView } from "./feedback-view"
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import { type StudentResult, type ResultStatus } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { Loader2, UploadCloud, FileText, BrainCircuit, BookCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const statusDetails: Record<ResultStatus, { icon: React.ElementType, text: string }> = {
    "업로드 중": { icon: UploadCloud, text: "오디오 파일 업로드 중..." },
    "텍스트 변환 중": { icon: FileText, text: "음성을 텍스트로 변환 중..." },
    "분석 중": { icon: BrainCircuit, text: "AI가 답변을 분석하고 있습니다." },
    "리포트 생성 중": { icon: BookCheck, text: "최종 리포트를 생성하고 있습니다." },
    "채점 완료": { icon: Loader2, text: "채점 완료!" },
    "오류": { icon: Loader2, text: "오류 발생" },
};

export default function AssessmentResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [result, setResult] = useState<StudentResult | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<ResultStatus>("업로드 중");
  const [currentProgress, setCurrentProgress] = useState<number>(0);
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
        
        setResultId(doc.id);
        
        if (resultData.status) {
            setResult(resultData);
            setCurrentStatus(resultData.status);
            setCurrentProgress(resultData.progress || 0);

            if (resultData.status === '오류') {
              setError(resultData.aiFeedback || "분석 중 오류가 발생했습니다.");
              setIsLoading(false);
            } else if (resultData.status === '채점 완료') {
              setIsLoading(false);
              setError(null);
            } else {
              setIsLoading(true); // Still grading
            }
        }
      } else {
        // This case can happen if the doc is not created yet, or if it has been cancelled.
        // It's safe to just stop loading and let the page render the "not found" state.
        setIsLoading(false);
      }
    }, (err) => {
      console.error("Error fetching result with onSnapshot: ", err);
      setError("결과를 불러오는 중 오류가 발생했습니다.");
      setIsLoading(false);
    });

    return () => unsubscribe(); // Cleanup subscription on unmount

  }, [id, user, authLoading, router]);
  
  const handleCancelAnalysis = async () => {
    if (!resultId) {
      toast({ title: "오류", description: "취소할 평가를 찾을 수 없습니다.", variant: "destructive" });
      return;
    }
    setIsCancelling(true);
    toast({ title: "분석을 취소하는 중..." });

    try {
      await deleteDoc(doc(db, "results", resultId));
      toast({ title: "성공", description: "분석이 취소되었습니다." });
      // Immediately redirect to the dashboard.
      router.push('/student/dashboard');
    } catch (error) {
      console.error("Error cancelling analysis: ", error);
      toast({ title: "오류", description: "분석 취소에 실패했습니다.", variant: "destructive" });
      setIsCancelling(false);
    }
  };

  if (isLoading || authLoading) {
    const { icon: Icon, text } = statusDetails[currentStatus] || statusDetails["업로드 중"];
    return (
      <Card className="flex flex-col items-center justify-center text-center p-8 h-96">
        <CardHeader>
          <Icon className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <CardTitle>AI 분석 진행 중</CardTitle>
          <CardDescription>{text}</CardDescription>
        </CardHeader>
        <CardContent className="w-full max-w-sm">
            <Progress value={currentProgress} className="mb-2" />
            <p className="text-sm text-muted-foreground">{currentProgress}% 완료</p>
            <p className="text-sm text-muted-foreground mt-4">분석이 완료되면 이 페이지가 자동으로 새로고침됩니다.</p>
        </CardContent>
        <CardFooter>
            <Button variant="destructive" onClick={handleCancelAnalysis} disabled={isCancelling}>
                {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                분석 취소
            </Button>
        </CardFooter>
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
            <p className="text-sm text-muted-foreground">평가를 먼저 완료했거나, 분석이 취소되었을 수 있습니다.</p>
        </div>
     );
  }

  return (
    <FeedbackView result={result} />
  )
}
