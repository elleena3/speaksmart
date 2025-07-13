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
      title: "Recording Started",
      description: "You have 1 minute to speak.",
    })
  }

  const handleStopRecording = async () => {
    setIsRecording(false)
    setIsProcessing(true)
    toast({
      title: "Recording Stopped",
      description: "Processing your audio...",
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
        title: "Processing Complete!",
        description: "Your feedback is ready to view.",
      })

      router.push(`/student/assessment/${assessmentDetails.id}/results`)

    } catch (error) {
      console.error("Error processing assessment:", error)
      toast({
        title: "Error",
        description: "There was a problem processing your recording. Please try again.",
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
          Processing...
        </Button>
      )
    }
    if (isRecording) {
      return (
        <Button size="lg" onClick={handleStopRecording} className="w-full" variant="destructive">
          <StopCircle className="mr-2 h-5 w-5" />
          Stop Recording
        </Button>
      )
    }
    return (
      <Button size="lg" onClick={handleStartRecording} className="w-full">
        <Mic className="mr-2 h-5 w-5" />
        Start Recording
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
      <p className="text-sm text-muted-foreground">Click "Start Recording" when you are ready.</p>
    </div>
  )
}
