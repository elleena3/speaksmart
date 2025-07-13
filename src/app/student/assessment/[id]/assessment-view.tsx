"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
// import { generateSpeakingFeedback } from "@/ai/flows/generate-speaking-feedback"

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
      // Here you would typically get the recorded audio data.
      // For this demo, we'll simulate the process.
      const studentRecordingDataUri = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="

      // This is commented out because we are not actually calling the AI in the scaffold.
      /*
      await generateSpeakingFeedback({
        activityPrompt: assessmentDetails.prompt,
        expectedFormat: assessmentDetails.expectedFormat,
        studentRecordingDataUri,
        studentFeedbackInstructions: "Provide feedback on fluency, pronunciation, and vocabulary usage. Be encouraging."
      });
      */
     
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 3000));

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
