
"use client";

import { FeedbackView } from "./feedback-view"
import { redirect } from 'next/navigation';
import { useEffect, useState } from "react";

export default function AssessmentResultsPage({ params }: { params: { id: string } }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (params.id === 'free-talk') {
      redirect('/student/assessment/free-talk/results');
      return;
    }
    
    // Fetch feedback from localStorage
    const storedFeedback = localStorage.getItem(`assessment_feedback_${params.id}`);
    if (storedFeedback) {
      setFeedback(storedFeedback);
    } else {
      // Fallback or handle case where feedback is not found
      setFeedback("피드백을 찾을 수 없습니다. 평가를 다시 완료해주세요.");
    }
    setIsLoading(false);
  }, [params.id]);


  if (isLoading) {
    return <div>피드백을 불러오는 중...</div>;
  }
  
  if (!feedback) {
     // This can happen if the redirect is being processed or if there's no feedback
     return <div>피드백이 없습니다.</div>;
  }

  return (
    <FeedbackView
      assessmentId={params.id}
      assessmentTitle="7단원: 취미와 관심사"
      aiFeedback={feedback}
    />
  )
}
