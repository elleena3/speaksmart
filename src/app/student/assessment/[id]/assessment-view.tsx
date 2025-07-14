
"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateComprehensiveFeedback } from "@/ai/flows/generate-comprehensive-feedback"
import { type StudentResult, type TeacherAssessment } from "@/lib/types"
import { useAuth } from "@/context/auth-context"
import { db } from "@/lib/firebase"
import { collection, addDoc, doc, writeBatch, query, where, getDocs } from "firebase/firestore"

export function AssessmentView({ assessmentDetails }: { assessmentDetails: TeacherAssessment }) {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const cleanup = () => {
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
    audioChunksRef.current = [];
  };

  const handleStartRecording = async () => {
    // Clear previous refs
    cleanup();
    setIsRecording(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        if (audioChunksRef.current.length === 0) {
            console.warn("No audio data recorded.");
            toast({
                title: "녹음된 오디오 없음",
                description: "오디오가 녹음되지 않았습니다. 마이크를 확인하고 다시 시도해주세요.",
                variant: "destructive"
            });
            setIsProcessing(false);
            cleanup();
            return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          processAssessment(base64Audio);
        };
        cleanup();
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

  const handleStopRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      setIsRecording(false)
      setIsProcessing(true)
      mediaRecorderRef.current.stop(); // This will trigger the onstop event
      toast({
        title: "녹음 중지됨",
        description: "오디오를 처리하고 AI 피드백을 생성 중입니다...",
      });
    }
  }
  
  const processAssessment = async (studentRecordingDataUri: string) => {
     if (!user) {
        toast({ title: "인증 오류", description: "사용자 정보를 찾을 수 없습니다.", variant: "destructive" });
        setIsProcessing(false);
        return;
     }

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
        expectedFormat: assessmentDetails.expectedFormat || "학생의 답변을 평가합니다.",
        studentRecordingDataUri,
        studentName: user.displayName || "Student",
        assessmentTitle: assessmentDetails.title.replace(' - 복사본', ''),
      });
      
      const resultData = {
        studentId: user.uid,
        assessmentId: assessmentDetails.id,
        assessmentTitle: assessmentDetails.title,
        name: user.displayName || "Student",
        avatarUrl: user.photoURL || `https://placehold.co/40x40.png?text=${user.displayName?.charAt(0)}`,
        status: "채점 완료",
        score,
        date: new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
        aiFeedback,
        curricularRemarks,
        studentFeedbackSummary: "학생이 평가에 대해 남긴 피드백이 없습니다.",
        teacherGuidance,
        studentTranscript,
        studentRecordingDataUri,
        pronunciationScore,
        pronunciationFeedback,
        teacherUid: assessmentDetails.uid,
      };

      const resultsRef = collection(db, "results");
      const q = query(resultsRef, where("assessmentId", "==", assessmentDetails.id), where("studentId", "==", user.uid));
      const existingDocs = await getDocs(q);

      const batch = writeBatch(db);
      existingDocs.forEach(doc => batch.delete(doc.ref));
      const newResultRef = doc(collection(db, "results"));
      batch.set(newResultRef, resultData);
      await batch.commit();

      toast({
        title: "처리 완료!",
        description: "피드백을 확인할 준비가 되었습니다.",
      });

      router.push(`/student/assessment/${assessmentDetails.id}/results`);

    } catch (error) {
      console.error("Error processing assessment:", error);
      toast({
        title: "오류",
        description: "녹음을 처리하는 중에 문제가 발생했습니다. 다시 시도해 주세요.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  }
  
  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      cleanup();
    };
  }, []);

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
