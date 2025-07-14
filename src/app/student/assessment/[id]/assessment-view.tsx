
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2, Timer, UploadCloud, FileText, BrainCircuit, BookCheck } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateSpeakingAnalysis } from "@/ai/flows/generate-speaking-analysis-flow"
import { type TeacherAssessment, type StudentResult, type ResultStatus } from "@/lib/types"
import { useAuth } from "@/context/auth-context"
import { db, storage } from "@/lib/firebase"
import { collection, doc, updateDoc, setDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"

const processingSteps: { status: ResultStatus; icon: React.ElementType; text: string }[] = [
  { status: "업로드 중", icon: UploadCloud, text: "오디오 파일 업로드 중..." },
  { status: "텍스트 변환 중", icon: FileText, text: "음성을 텍스트로 변환 중..." },
  { status: "분석 중", icon: BrainCircuit, text: "AI가 답변을 분석 중입니다..." },
  { status: "리포트 생성 중", icon: BookCheck, text: "최종 리포트를 생성하고 있습니다..." },
];

export function AssessmentView({ assessmentDetails }: { assessmentDetails: TeacherAssessment }) {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ResultStatus | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const router = useRouter()
  const { toast } = useToast()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const timeLimit = assessmentDetails.recordingTimeLimit && assessmentDetails.recordingTimeLimit > 0 
    ? assessmentDetails.recordingTimeLimit * 60 
    : null;

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop(); // This will trigger the onstop event
    }
  }, []);

  const cleanup = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.onerror = null;
      mediaRecorderRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    audioChunksRef.current = [];
  }, []);

  useEffect(() => {
    if (remainingTime === 0) {
      handleStopRecording();
    }
  }, [remainingTime, handleStopRecording]);
  
  const startTimer = () => {
    if (timeLimit) {
      setRemainingTime(timeLimit);
      timerIntervalRef.current = setInterval(() => {
        setRemainingTime(prevTime => {
          if (prevTime === null || prevTime <= 1) {
            if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
  };

  const handleStartRecording = async () => {
    cleanup();
    setIsRecording(true);
    if(timeLimit) setRemainingTime(timeLimit);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, { 
        mimeType: 'audio/webm',
      });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        
        toast({
            title: "제출 완료",
            description: "답변이 제출되었습니다. AI 분석이 시작되며, 완료되면 알려드립니다.",
        });

        if (audioChunksRef.current.length === 0) {
            console.warn("No audio data recorded.");
            toast({
                title: "녹음된 오디오 없음",
                description: "오디오가 녹음되지 않았습니다. 마이크를 확인하고 다시 시도해주세요.",
                variant: "destructive"
            });
            setIsProcessing(false);
            cleanup();
            if (timeLimit) setRemainingTime(timeLimit);
            return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          // Don't await this. Let it run in the background.
          processAssessmentInBackground(audioBlob, base64Audio);
        };
        cleanup();
        
        // Immediately redirect user
        router.push(`/student/assessment/${assessmentDetails.id}/results`);
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        toast({
            title: "녹음 오류",
            description: "녹음 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
            variant: "destructive"
        });
        setIsRecording(false);
        setIsProcessing(false);
        cleanup();
      }

      mediaRecorderRef.current.start();
      startTimer();
      toast({
        title: "녹음 시작됨",
        description: "말씀을 마치신 후 녹음 중지 버튼을 눌러주세요.",
      });

    } catch (error) {
      console.error("Error accessing microphone:", error)
      toast({
        title: "마이크 접근 오류",
        description: "마이크 접근 권한을 허용해주세요.",
        variant: "destructive"
      });
      setIsRecording(false);
    }
  }
  
  const processAssessmentInBackground = async (audioBlob: Blob, studentRecordingDataUri: string) => {
     if (!user) {
        console.error("Authentication error: User not found for background processing.");
        return;
     }

     const newResultRef = doc(collection(db, "results"));

     const updateStatus = async (status: ResultStatus, progress: number, data: Partial<StudentResult> = {}) => {
        await updateDoc(newResultRef, { status, progress, ...data });
     };

     try {
        const initialResultData: Partial<StudentResult> = {
            id: newResultRef.id,
            studentId: user.uid,
            assessmentId: assessmentDetails.id,
            assessmentTitle: assessmentDetails.title,
            name: user.displayName || "Student",
            avatarUrl: user.photoURL || `https://placehold.co/40x40.png?text=${user.displayName?.charAt(0)}`,
            status: "업로드 중",
            progress: 10,
            date: new Date().toISOString().split('T')[0],
            createdAt: Date.now(),
            teacherUid: assessmentDetails.uid,
        };
        await setDoc(newResultRef, initialResultData);
        
        const audioFileName = `recordings/${user.uid}_${assessmentDetails.id}_${Date.now()}.webm`;
        const storageRef = ref(storage, audioFileName);
        await uploadBytes(storageRef, audioBlob);
        const downloadURL = await getDownloadURL(storageRef);
        
        const analysisResult = await generateSpeakingAnalysis({
            studentRecordingDataUri,
            activityPrompt: assessmentDetails.prompt,
            expectedFormat: assessmentDetails.expectedFormat || "학생의 답변을 평가합니다.",
            studentName: user.displayName || "Student",
            assessmentTitle: assessmentDetails.title.replace(/ - 복사본(\s\d+)?$/, ''),
        }, (status, progress) => updateStatus(status as ResultStatus, progress));

        const finalResultData: Omit<StudentResult, 'id' | 'status' | 'progress'> = {
            studentId: user.uid,
            assessmentId: assessmentDetails.id,
            assessmentTitle: assessmentDetails.title,
            name: user.displayName || "Student",
            avatarUrl: user.photoURL || `https://placehold.co/40x40.png?text=${user.displayName?.charAt(0)}`,
            score: analysisResult.contentScore,
            date: new Date().toISOString().split('T')[0],
            createdAt: initialResultData.createdAt!,
            aiFeedback: analysisResult.aiFeedback,
            curricularRemarks: analysisResult.curricularRemarks,
            studentFeedbackSummary: "학생이 평가에 대해 남긴 피드백이 없습니다.",
            teacherGuidance: analysisResult.teacherGuidance,
            studentTranscript: analysisResult.studentTranscript,
            studentRecordingDataUri: downloadURL,
            pronunciationScore: analysisResult.pronunciationScore,
            pronunciationFeedback: analysisResult.pronunciationFeedback,
            teacherUid: assessmentDetails.uid,
        };
        
        await updateDoc(newResultRef, { 
            status: "채점 완료",
            progress: 100,
            ...finalResultData 
        });
        
    } catch (error) {
        console.error("Error processing assessment in background:", error);
        await updateDoc(newResultRef, { 
            status: "오류", 
            progress: 100,
            aiFeedback: "결과를 분석하는 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요."
        });
    }
  }
  
  useEffect(() => {
    if (timeLimit) {
      setRemainingTime(timeLimit);
    }
    return () => {
      cleanup();
    };
  }, [timeLimit, cleanup]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getButtonState = () => {
    if (isRecording) {
      return (
        <Button size="lg" onClick={handleStopRecording} className="w-full" variant="destructive">
          <StopCircle className="mr-2 h-5 w-5" />
          녹음 중지
        </Button>
      )
    }
    return (
      <Button size="lg" onClick={handleStartRecording} className="w-full" disabled={isProcessing}>
        {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Mic className="mr-2 h-5 w-5" />}
        {isProcessing ? "제출 중..." : "녹음 시작"}
      </Button>
    )
  }

  const timerDisplay = formatTime(remainingTime);

  return (
    <div className="flex flex-col items-center gap-6 p-8 border rounded-lg bg-muted/50">
      {timeLimit && (
        <div className="flex items-center gap-2 text-lg font-semibold text-muted-foreground">
          <Timer className="h-6 w-6" />
          <span>{isRecording ? timerDisplay : formatTime(timeLimit)}</span>
        </div>
      )}
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
