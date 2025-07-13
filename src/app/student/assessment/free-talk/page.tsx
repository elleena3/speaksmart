import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FreeTalkView } from "./free-talk-view"

export default function FreeTalkPage() {
  const assessmentDetails = {
    id: "free-talk",
    title: "자유 대화",
    prompt: "AI와 자유롭게 영어로 대화해 보세요. 준비가 되면 '대화 시작' 버튼을 누르세요.",
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{assessmentDetails.title}</CardTitle>
          <CardDescription>{assessmentDetails.prompt}</CardDescription>
        </CardHeader>
        <CardContent>
          <FreeTalkView />
        </CardContent>
      </Card>
    </div>
  )
}
