import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AssessmentView } from "./assessment-view"

export default function AssessmentPage({ params }: { params: { id: string } }) {
  const assessmentDetails = {
    id: params.id,
    title: "7단원: 취미와 관심사",
    prompt: "가장 좋아하는 취미에 대해 이야기해주세요. 무엇인지, 왜 좋아하는지, 얼마나 자주 하는지 언급해야 합니다. 1분 동안 말할 시간이 주어집니다.",
    expectedFormat: "학생은 취미를 소개하고, 좋아하는 이유를 제시하며, 빈도를 언급해야 합니다. 현재 시제와 관련 어휘 사용이 예상됩니다."
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
