
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateSpeakingFeedback } from "@/ai/flows/generate-speaking-feedback"
import { type StudentResult } from "@/lib/types"

type AssessmentDetails = {
  id: string,
  title: string,
  prompt: string,
  expectedFormat: string
}

export function AssessmentView({ assessmentDetails }: { assessmentDetails: AssessmentDetails }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleStartRecording = () => {
    setIsRecording(true)
    toast({
      title: "녹음 시작됨",
      description: "1분 동안 말씀하실 수 있습니다.",
    })
  }

  const handleStopRecording = async () => {
    setIsRecording(false)
    setIsProcessing(true)
    toast({
      title: "녹음 중지됨",
      description: "오디오를 처리 중입니다...",
    })

    try {
      // In a real app, this would come from a microphone recording.
      // For this demo, we'll use a placeholder short, silent audio data URI.
      const studentRecordingDataUri = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="

      const feedbackResult = await generateSpeakingFeedback({
        activityPrompt: assessmentDetails.prompt,
        expectedFormat: assessmentDetails.expectedFormat,
        studentRecordingDataUri,
        studentFeedbackInstructions: "Provide feedback on fluency, pronunciation, and vocabulary usage. Be encouraging."
      });

      // In a real app, this would be more sophisticated.
      const score = Math.floor(Math.random() * (98 - 80 + 1)) + 80;

      const studentResult: StudentResult = {
        studentId: "student-alex-doe",
        assessmentId: assessmentDetails.id,
        name: "Alex Doe",
        avatarUrl: "https://placehold.co/40x40.png",
        status: "채점 완료",
        score,
        date: new Date().toISOString().split('T')[0],
        aiFeedback: feedbackResult.feedback,
        // Mocking these for now as they require more complex flows
        curricularRemarks: "학생은 주어진 주제에 대해 논리적으로 자신의 경험을 잘 설명함. 특히, 과거 시제를 적절히 사용하여 문장을 구성하는 능력이 돋보임. 어휘 사용 범위가 다소 제한적이었으나, 핵심 내용은 명확하게 전달함. 발음은 대체로 양호하나, 일부 단어에서 강세 위치를 개선할 필요가 있음. 전반적으로 성실하게 과제에 임하는 태도가 긍정적임.",
        studentFeedbackSummary: "학생은 평가 주제가 흥미로웠다고 응답했으나, 답변 준비 시간이 조금 더 길었으면 좋겠다는 의견을 제시함. AI의 피드백이 전반적으로 도움이 되었다고 평가함.",
        teacherGuidance: "이 학생은 문법 구조에 대한 이해도가 높습니다. 다양한 어휘를 사용할 수 있도록 유의어 및 관련 표현 학습을 독려해주세요. 역할극이나 짧은 발표 활동을 통해 자신감을 키워주는 것이 도움이 될 것입니다."
      }
      
      const existingResults: StudentResult[] = JSON.parse(localStorage.getItem('student_results') || '[]');
      const updatedResults = [...existingResults.filter(r => r.assessmentId !== assessmentDetails.id), studentResult];
      localStorage.setItem('student_results', JSON.stringify(updatedResults));
      localStorage.setItem(`assessment_feedback_${assessmentDetails.id}`, feedbackResult.feedback);

      toast({
        title: "처리 완료!",
        description: "피드백을 확인할 준비가 되었습니다.",
      })

      router.push(`/student/assessment/${assessmentDetails.id}/results`)

    } catch (error) {
      console.error("Error processing assessment:", error)
      toast({
        title: "오류",
        description: "녹음을 처리하는 중에 문제가 발생했습니다. 다시 시도해 주세요.",
        variant: "destructive",
      })
      setIsProcessing(false)
    }
  }

  const getButtonState = () => {
    if (isProcessing) {
      return (
        <Button size="lg" disabled className="w-full">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          처리 중...
        </Button>
      )
    }
    if (isRecording) {
      return (
        <Button size="lg" onClick={handleStopRecording} className="w-full" variant="destructive">
          <StopCircle className="mr-2 h-5 w-5" />
          녹음 중지
        </Button>
      )
    }
    return (
      <Button size="lg" onClick={handleStartRecording} className="w-full">
        <Mic className="mr-2 h-5 w-5" />
        녹음 시작
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8 border rounded-lg bg-muted/50">
      <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-background">
        <Mic className={`h-16 w-16 text-primary transition-all ${isRecording ? 'scale-110' : ''}`} />
        {isRecording && <div className="absolute inset-0 rounded-full bg-destructive/20 animate-pulse"></div>}
      </div>
      <div className="w-full max-w-xs">
        {getButtonState()}
      </div>
      <p className="text-sm text-muted-foreground">준비가 되면 "녹음 시작"을 클릭하세요.</p>
    </div>
  )
}
