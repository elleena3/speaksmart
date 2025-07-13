import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AssessmentView } from "../[id]/assessment-view"

export default function FreeTalkPage() {
    const assessmentDetails = {
        id: "free-talk",
        title: "자유 대화",
        prompt: "AI와 3분 동안 자유롭게 영어로 대화해 보세요. 준비가 되면 '녹음 시작' 버튼을 누르세요.",
        expectedFormat: "자유로운 형식의 대화입니다. 학생은 다양한 주제에 대해 자신의 생각과 의견을 표현할 수 있습니다."
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
