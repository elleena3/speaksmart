import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AssessmentView } from "./assessment-view"

export default function AssessmentPage({ params }: { params: { id: string } }) {
  const assessmentDetails = {
    id: params.id,
    title: "Unit 7: Hobbies and Interests",
    prompt: "Please talk about your favorite hobby. You should mention what it is, why you like it, and how often you do it. You will have 1 minute to speak.",
    expectedFormat: "Student should introduce a hobby, provide reasons for liking it, and state the frequency. Use of present simple tense and relevant vocabulary is expected."
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{assessmentDetails.title}</CardTitle>
          <CardDescription>{assessmentDetails.prompt}</CardDescription>
        </CardHeader>
        <CardContent>
          <AssessmentView assessmentDetails={assessmentDetails} />
        </CardContent>
      </Card>
    </div>
  )
}
