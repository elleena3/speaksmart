
"use client";

import { FreeTalkFeedbackView } from "./free-talk-feedback-view"
import { Suspense } from "react";

function FreeTalkResultsPageContent() {
  return <FreeTalkFeedbackView />;
}

export default function FreeTalkResultsPage() {
  return (
    <Suspense fallback={<div>Loading feedback...</div>}>
      <FreeTalkResultsPageContent />
    </Suspense>
  )
}
