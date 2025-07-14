
"use client";

import { FeedbackView } from "./feedback-view"
import { redirect } from 'next/navigation';
import { useEffect, useState } from "react";
import { type StudentResult } from "@/lib/types";

export default function AssessmentResultsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [result, setResult] = useState<StudentResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // This is a safeguard against incorrect routing.
    // Free talk assessments have their own specific results page.
    if (id === 'free-talk') {
      redirect('/student/assessment/free-talk/results');
      return;
    }
    
    // Fetch result from localStorage
    const storedResults: StudentResult[] = JSON.parse(localStorage.getItem('student_results') || '[]');
    const currentResult = storedResults.find(r => r.assessmentId === id);
    
    if (currentResult) {
      setResult(currentResult);
    } 
    setIsLoading(false);
  }, [id]);


  if (isLoading) {
    return <div className="text-center p-8">결과를 불러오는 중...</div>;
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
    <FeedbackView
      assessmentId={id}
      assessmentTitle="7단원: 취미와 관심사"
      aiFeedback={result.aiFeedback}
      studentTranscript={result.studentTranscript || "음성인식 결과가 없습니다."}
    />
  )
}
