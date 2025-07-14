
"use client";

import { FreeTalkFeedbackView } from "./free-talk-feedback-view"
import { Suspense } from "react";

// This component is now just a wrapper for FreeTalkFeedbackView
// It needs Suspense because FreeTalkFeedbackView uses useSearchParams.
function FreeTalkResultsPageContent() {
  return <FreeTalkFeedbackView />;
}

export default function FreeTalkResultsPage() {
  return (
    <Suspense fallback={<div className="text-center p-8">피드백을 불러오는 중...</div>}>
      <FreeTalkResultsPageContent />
    </Suspense>
  )
}
