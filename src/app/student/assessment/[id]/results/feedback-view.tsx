
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Send, ThumbsUp, ThumbsDown, MessageSquareQuote, Loader2, FileText, PlayCircle } from "lucide-react"
import { summarizeStudentFeedback } from "@/ai/flows/summarize-student-feedback"
import { type StudentResult } from "@/lib/types"

type FeedbackViewProps = {
  assessmentId: string;
  assessmentTitle: string;
  aiFeedback: string;
  studentTranscript: string;
  studentRecordingDataUri?: string;
}

export function FeedbackView({ assessmentId, assessmentTitle, aiFeedback, studentTranscript, studentRecordingDataUri }: FeedbackViewProps) {
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
    toast({ title: "피드백을 요약하여 제출하는 중..." })
    
    try {
      const { summary } = await summarizeStudentFeedback({ feedbackText: teacherFeedback });

      // Update the student result in localStorage with the summarized feedback
      const existingResults: StudentResult[] = JSON.parse(localStorage.getItem('student_results') || '[]');
      const resultIndex = existingResults.findIndex(r => r.assessmentId === assessmentId);

      if (resultIndex > -1) {
        existingResults[resultIndex].studentFeedbackSummary = summary;
        localStorage.setItem('student_results', JSON.stringify(existingResults));
      }
      
      setIsSubmitting(false)
      setTeacherFeedback("")
      toast({
        title: "피드백이 제출되었습니다!",
        description: "개선에 도움을 주셔서 감사합니다."
      })
    } catch(error) {
        console.error("Error submitting feedback:", error);
        toast({
            title: "오류",
            description: "피드백을 제출하는 중 문제가 발생했습니다.",
            variant: "destructive"
        })
        setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary shrink-0" />
                <div>
                  <CardTitle className="text-2xl">내 답변</CardTitle>
                  <CardDescription>음성인식으로 변환된 나의 답변과 녹음 파일입니다.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {studentRecordingDataUri && (
                    <div>
                        <audio controls src={studentRecordingDataUri} className="w-full">
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                )}
                <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-mono text-sm leading-relaxed italic">
                    "{studentTranscript}"
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <MessageSquareQuote className="w-8 h-8 text-primary shrink-0" />
                <div>
                  <CardTitle className="text-2xl">"{assessmentTitle}"에 대한 AI 영어 회화 평가 피드백</CardTitle>
                  <CardDescription>AI가 생성한 성과 분석입니다.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-base leading-relaxed">
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
      </div>
      
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
