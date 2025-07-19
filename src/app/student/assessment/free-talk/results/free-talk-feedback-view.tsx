
"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Send, ThumbsUp, ThumbsDown, MessageSquareQuote, Loader2, FileText, Target, Repeat, Bot, User } from "lucide-react"
import { summarizeStudentFeedback } from "@/ai/flows/summarize-student-feedback"
import { type StudentResult, type TeacherAssessment } from "@/lib/types"
import { Progress } from "@/components/ui/progress"
import { db } from "@/lib/firebase"
import { doc, updateDoc } from "firebase/firestore"

type FeedbackViewProps = {
  result: StudentResult
  assessment: TeacherAssessment
  isLatestAttempt: boolean
}

export function FreeTalkFeedbackView({ result, assessment, isLatestAttempt }: FeedbackViewProps) {
  const [teacherFeedback, setTeacherFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [satisfaction, setSatisfaction] = useState<"good" | "bad" | null>(null);
  const { toast } = useToast()

  const {
    id: resultId,
    aiFeedback,
    studentTranscript,
    studentRecordingUrl,
    pronunciationScore,
    pronunciationFeedback,
    contentScore,
    studentRawFeedback,
  } = result;

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

      const resultRef = doc(db, "results", resultId);
      await updateDoc(resultRef, {
        studentFeedbackSummary: summary,
        studentRawFeedback: teacherFeedback, // 원본 피드백 저장
      });
      
      toast({
        title: "피드백이 제출되었습니다!",
        description: "개선에 도움을 주셔서 감사합니다."
      })
      // Optimistically update local state to show the submitted feedback
      result.studentRawFeedback = teacherFeedback;
      result.studentFeedbackSummary = summary;
      setTeacherFeedback("");

    } catch(error) {
        console.error("Error submitting feedback:", error);
        toast({
            title: "오류",
            description: "피드백을 제출하는 중 문제가 발생했습니다.",
            variant: "destructive"
        })
    } finally {
      setIsSubmitting(false);
    }
  }

  const retryLink = assessment.assessmentType === 'dialogue'
    ? `/student/assessment/free-talk?id=${assessment.id}`
    : `/student/assessment/${assessment.id}`;

  const dialogueTurns = studentTranscript?.split('\n').map(line => {
    const [role, ...textParts] = line.split(': ');
    const text = textParts.join(': ');
    return { role: role, text: text };
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary shrink-0" />
                <div>
                  <CardTitle className="text-2xl">대화 기록</CardTitle>
                  <CardDescription>AI와의 전체 대화 기록과 전체 녹음 파일입니다.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {studentRecordingUrl && (
                    <div>
                        <audio controls src={studentRecordingUrl} className="w-full">
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                )}
                <div className="p-4 bg-muted/50 rounded-lg max-h-80 overflow-y-auto space-y-4">
                  {dialogueTurns?.map((turn, index) => (
                    <div key={index} className={`flex items-start gap-3 ${turn.role === '학생' ? 'justify-start' : 'justify-end'}`}>
                      {turn.role === '학생' && (
                          <div className="p-2 rounded-full bg-background border">
                              <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                      )}
                      <div className={`p-3 rounded-lg max-w-[80%] ${turn.role === '학생' ? 'bg-background' : 'bg-primary text-primary-foreground'}`}>
                        <p className="text-sm font-semibold mb-1">{turn.role === '학생' ? '나' : assessment.aiVoice || 'AI'}</p>
                        <p className="text-sm">{turn.text}</p>
                      </div>
                      {turn.role !== '학생' && (
                          <div className="p-2 rounded-full bg-primary text-primary-foreground">
                              <Bot className="h-5 w-5" />
                          </div>
                      )}
                    </div>
                  ))}
                  {(!dialogueTurns || dialogueTurns.length === 0) && (
                     <p className="text-muted-foreground text-center italic">대화 기록이 없습니다.</p>
                  )}
                </div>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Target className="w-8 h-8 text-primary shrink-0" />
                <div>
                  <CardTitle className="text-2xl">상세 분석</CardTitle>
                  <CardDescription>AI가 분석한 내용/발음 정확도와 피드백입니다.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {contentScore !== undefined && (
                    <div className="w-full">
                       <div className="flex justify-between mb-1">
                          <span className="text-base font-medium text-primary">내용 점수</span>
                          <span className="text-sm font-medium text-primary">{contentScore}%</span>
                      </div>
                      <Progress value={contentScore} className="h-2" />
                    </div>
                )}
                {pronunciationScore !== undefined && (
                    <div className="w-full">
                       <div className="flex justify-between mb-1">
                          <span className="text-base font-medium text-primary">발음 점수</span>
                          <span className="text-sm font-medium text-primary">{pronunciationScore}%</span>
                      </div>
                      <Progress value={pronunciationScore} className="h-2" />
                    </div>
                )}
                {pronunciationFeedback && (
                    <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-base leading-relaxed">
                      <h4 className="font-semibold mb-2">발음 피드백</h4>
                      {pronunciationFeedback}
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <MessageSquareQuote className="w-8 h-8 text-primary shrink-0" />
                <div>
                  <CardTitle className="text-2xl">AI 종합 피드백</CardTitle>
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
      
      <div className="lg:col-span-1 space-y-6">
        {isLatestAttempt && (
             <Card>
                <CardHeader>
                  <CardTitle>다시 해보기</CardTitle>
                  <CardDescription>이 평가에 다시 도전하여 실력을 향상시켜 보세요.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={retryLink} passHref>
                    <Button className="w-full">
                      <Repeat className="mr-2 h-4 w-4" /> 다시 해보기
                    </Button>
                  </Link>
                </CardContent>
              </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>교사에게 보내는 피드백</CardTitle>
            <CardDescription>
                {studentRawFeedback 
                ? "아래는 교사에게 보낸 나의 피드백입니다." 
                : "이 평가 활동에 대해 어떻게 생각하는지 교사에게 알려주세요."}
            </CardDescription>
          </CardHeader>
          <CardContent>
             {studentRawFeedback ? (
              <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed italic">
                {studentRawFeedback}
              </div>
            ) : (
              <Textarea 
                placeholder="예: 주제는 흥미로웠지만 시간이 좀 짧았습니다."
                value={teacherFeedback}
                onChange={(e) => setTeacherFeedback(e.target.value)}
                rows={6}
              />
            )}
          </CardContent>
          {!studentRawFeedback && (
            <CardFooter>
              <Button className="w-full" onClick={handleSubmitFeedback} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {isSubmitting ? "제출 중..." : "피드백 보내기"}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  )
}
