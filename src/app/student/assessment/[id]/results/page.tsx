import { FeedbackView } from "./feedback-view"

const aiFeedback = {
  feedback: "Great job on describing your hobby! You spoke clearly and at a good pace. Your vocabulary was appropriate for the topic. \n\n**Areas for improvement:**\n\n*   **Pronunciation:** Be mindful of the 'th' sound in words like 'three' and 'with'. Try practicing tongue twisters to improve this.\n*   **Fluency:** You had a few pauses. Try to connect your ideas more smoothly. You could use connecting words like 'also', 'in addition', or 'because'.\n\nKeep up the great work!",
}

export default function AssessmentResultsPage({ params }: { params: { id: string } }) {
  return (
    <FeedbackView
      assessmentId={params.id}
      assessmentTitle="Unit 7: Hobbies and Interests"
      aiFeedback={aiFeedback.feedback}
    />
  )
}
