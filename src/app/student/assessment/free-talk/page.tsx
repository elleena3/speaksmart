import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FreeTalkView } from "./free-talk-view"

export default function FreeTalkPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">자유 대화</CardTitle>
          <CardDescription>AI와 3분 동안 자유롭게 영어로 대화해 보세요. 준비가 되면 AI가 먼저 말을 걸어올 것입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <FreeTalkView />
        </CardContent>
      </Card>
    </div>
  )
}
