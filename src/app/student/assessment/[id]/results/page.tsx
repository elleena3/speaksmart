
"use client";

import { FeedbackView } from "./feedback-view"
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import { type StudentResult, type ResultStatus } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_STUDENT_RESULTS } from "@/lib/mock-data";

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

    // 로컬 목업 모드
    setTimeout(() => {
        let resultData = MOCK_STUDENT_RESULTS.find(r => r.assessmentId === id && r.studentId === user.uid);

        // If no pre-existing result, check session storage for a new mock submission
        if (!resultData) {
            const newSubmission = sessionStorage.getItem('mockResult');
            if (newSubmission) {
                const { assessmentId: submittedAssessmentId, studentRecordingDataUri } = JSON.parse(newSubmission);
                if (submittedAssessmentId === id) {
                    // Find a generic mock result for this assessment and modify it
                    resultData = { ...MOCK_STUDENT_RESULTS[0] }; // Use a template
                    resultData.assessmentId = id;
                    resultData.studentId = user.uid;
                    resultData.name = user.displayName || '이학생';
                    resultData.avatarUrl = user.photoURL || '';
                    resultData.studentRecordingDataUri = studentRecordingDataUri;
                    resultData.status = "채점 완료";
                    sessionStorage.removeItem('mockResult');
                }
            }
        }

        if (resultData) {
            setResult(resultData);
        } else {
            setError("해당 평가에 대한 목업 결과를 찾을 수 없습니다.");
        }
        setIsLoading(false);
    }, 1000); // Simulate loading

  }, [id, user, authLoading, router]);
  
  if (isLoading || authLoading) {
    return (
      <Card className="flex flex-col items-center justify-center text-center p-8 h-96">
        <CardHeader>
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <CardTitle>AI 분석 진행 중 (목업)</CardTitle>
          <CardDescription>목업 데이터를 불러오고 있습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  if (error) {
    return (
        <Card className="flex flex-col items-center justify-center text-center p-8 h-80 bg-destructive/10 border-destructive">
            <CardHeader>
                <CardTitle className="text-destructive">오류</CardTitle>
                <CardDescription className="text-destructive-foreground">{error}</CardDescription>
            </CardHeader>
        </Card>
    );
  }

  if (!result) {
     return (
        <div className="text-center p-8">
            <p>평가 결과를 찾을 수 없습니다.</p>
        </div>
     );
  }

  return (
    <FeedbackView result={result} />
  )
}
