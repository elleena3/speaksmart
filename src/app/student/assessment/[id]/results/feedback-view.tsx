"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Send, ThumbsUp, ThumbsDown, MessageSquareQuote, Loader2 } from "lucide-react"

type FeedbackViewProps = {
  assessmentId: string;
  assessmentTitle: string;
  aiFeedback: string;
}

export function FeedbackView({ assessmentId, assessmentTitle, aiFeedback }: FeedbackViewProps) {
  const [teacherFeedback, setTeacherFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [satisfaction, setSatisfaction] = useState<"good" | "bad" | null>(null);
  const { toast } = useToast()

  const handleSubmitFeedback = async () => {
    if (!teacherFeedback.trim()) {
      toast({
        title: "피드백이 비어있습니다",
        description: "제출하기 전에 피드백을 작성해주세요.",
        variant: "destructive"
      })
      return
    }
    setIsSubmitting(true)
    toast({ title: "피드백을 제출하는 중..." })
    
    // Simulate API call to summarizeStudentFeedback
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false)
    setTeacherFeedback("")
    toast({
      title: "피드백이 제출되었습니다!",
      description: "개선에 도움을 주셔서 감사합니다."
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-3">
            <MessageSquareQuote className="w-8 h-8 text-primary shrink-0" />
            <div>
              <CardTitle className="text-2xl">"{assessmentTitle}"에 대한 피드백</CardTitle>
              <CardDescription>AI가 생성한 성과 분석입니다.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed">
            {aiFeedback}
          </div>
        </CardContent>
        <CardFooter className="flex-col items-start gap-4">
            <p className="text-sm font-medium">이 피드백이 도움이 되었나요?</p>
            <div className="flex gap-2">
                <Button variant={satisfaction === 'good' ? 'default' : 'outline'} onClick={() => setSatisfaction('good')}>
                    <ThumbsUp className="mr-2 h-4 w-4" /> 유용함
                </Button>
                <Button variant={satisfaction === 'bad' ? 'destructive' : 'outline'} onClick={() => setSatisfaction('bad')}>
                    <ThumbsDown className="mr-2 h-4 w-4" /> 유용하지 않음
                </Button>
            </div>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>교사에게 보내는 피드백</CardTitle>
          <CardDescription>이 평가 활동에 대해 어떻게 생각하는지 교사에게 알려주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea 
            placeholder="예: 주제는 흥미로웠지만 시간이 좀 짧았습니다."
            value={teacherFeedback}
            onChange={(e) => setTeacherFeedback(e.target.value)}
            rows={6}
          />
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleSubmitFeedback} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {isSubmitting ? "제출 중..." : "피드백 보내기"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
