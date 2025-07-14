
"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateComprehensiveFeedback } from "@/ai/flows/generate-comprehensive-feedback"
import { type StudentResult, type TeacherAssessment } from "@/lib/types"

export function AssessmentView({ assessmentDetails }: { assessmentDetails: TeacherAssessment }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstart = () => {
        setIsRecording(true)
        toast({
          title: "녹음 시작됨",
          description: "말씀을 마치신 후 녹음 중지 버튼을 눌러주세요.",
        })
      };
      mediaRecorderRef.current.start();
    } catch (error) {
      console.error("Error accessing microphone:", error)
      toast({
        title: "마이크 접근 오류",
        description: "마이크 접근 권한을 허용해주세요.",
        variant: "destructive"
      });
    }
  }

  const handleStopRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          processAssessment(base64Audio);
        };
        audioChunksRef.current = [];
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false)
      setIsProcessing(true)
      toast({
        title: "녹음 중지됨",
        description: "오디오를 처리하고 AI 피드백을 생성 중입니다...",
      })
    }
  }
  
  const processAssessment = async (studentRecordingDataUri: string) => {
     try {
      const { 
        aiFeedback, 
        curricularRemarks, 
        teacherGuidance, 
        score, 
        studentTranscript,
        pronunciationScore,
        pronunciationFeedback
      } = await generateComprehensiveFeedback({
        activityPrompt: assessmentDetails.prompt,
        expectedFormat: assessmentDetails.prompt, // Using prompt as expected format for monologue
        studentRecordingDataUri,
        studentName: "Alex Doe", // In a real app, this would be dynamic
        assessmentTitle: assessmentDetails.title,
      });

      const studentResult: StudentResult = {
        studentId: "student-alex-doe",
        assessmentId: assessmentDetails.id,
        assessmentTitle: assessmentDetails.title,
        name: "Alex Doe",
        avatarUrl: "https://placehold.co/40x40.png",
        status: "채점 완료",
        score,
        date: new Date().toISOString().split('T')[0],
        aiFeedback,
        curricularRemarks,
        studentFeedbackSummary: "학생이 평가에 대해 남긴 피드백이 없습니다.", // This will be updated later if the student provides it
        teacherGuidance,
        studentTranscript,
        studentRecordingDataUri,
        pronunciationScore,
        pronunciationFeedback,
      }
      
      const existingResults: StudentResult[] = JSON.parse(localStorage.getItem('student_results') || '[]');
      const updatedResults = [...existingResults.filter(r => r.assessmentId !== assessmentDetails.id), studentResult];
      localStorage.setItem('student_results', JSON.stringify(updatedResults));

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
