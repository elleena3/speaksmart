
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2, Timer, Send, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { type TeacherAssessment } from "@/lib/types"
import { useAuth } from "@/context/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type RecordingState = "idle" | "recording" | "recorded" | "submitting";

const mimeType = 'audio/webm;codecs=opus';

export function AssessmentView({ assessmentDetails }: { assessmentDetails: TeacherAssessment }) {
  const { user } = useAuth();
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSize, setAudioSize] = useState<number | null>(null);
  
  const router = useRouter()
  const { toast } = useToast()
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const timeLimit = assessmentDetails.recordingTimeLimit && assessmentDetails.recordingTimeLimit > 0 
    ? assessmentDetails.recordingTimeLimit * 60 
    : null;

  const cleanupRecorder = useCallback(() => {
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
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioSize(null);
  }, [audioUrl]);


  const handleStartRecording = async () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioSize(null);
    if(recordingState !== 'idle') {
      cleanupRecorder();
    }
    
    setRecordingState("recording");
    if(timeLimit) setRemainingTime(timeLimit);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, { 
        mimeType: mimeType,
      });
      
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
            setRecordingState("idle");
            if (timeLimit) setRemainingTime(timeLimit);
            cleanupRecorder();
            return;
        }

        const newAudioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(newAudioBlob);
        setAudioUrl(URL.createObjectURL(newAudioBlob));
        setAudioSize(newAudioBlob.size);
        setRecordingState("recorded");
        toast({ title: "녹음 완료", description: "아래에서 녹음을 확인하고 제출해주세요." });
        cleanupRecorder();
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        toast({
            title: "녹음 오류",
            description: "녹음 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
            variant: "destructive"
        });
        setRecordingState("idle");
        cleanupRecorder();
      }

      mediaRecorderRef.current.start(100); // Use timeslice to get data chunks immediately
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
      setRecordingState("idle");
    }
  }

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  }, []);

  const handleSubmit = async () => {
    if (!audioBlob || !user) {
        toast({ title: "오류", description: "제출할 오디오 파일이 없습니다.", variant: "destructive" });
        return;
    }
    setRecordingState("submitting");

    try {
        toast({
            title: "제출 중...",
            description: "답변을 서버로 전송하고 AI 분석을 시작합니다.",
        });

        // Pass all necessary data via session storage for the results page to handle.
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
            sessionStorage.setItem('monologueResult', JSON.stringify({
                assessmentId: assessmentDetails.id,
                studentRecordingDataUri: reader.result as string,
                assessmentDetails: assessmentDetails, // Pass full details
            }));
            router.push(`/student/assessment/${assessmentDetails.id}/results`);
        };

    } catch (error) {
        console.error("Error preparing for submission:", error);
        toast({ title: "제출 준비 오류", description: "답변을 제출하는 중 오류가 발생했습니다.", variant: "destructive" });
        setRecordingState("recorded"); // Allow user to try again
    }
  }
  
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
  
  useEffect(() => {
    if (timeLimit) {
      setRemainingTime(timeLimit);
    }
    return () => {
      cleanupRecorder();
    };
  }, [timeLimit, cleanupRecorder]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (bytes === null) return "";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `(파일 크기: ${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]})`;
  };

  const timerDisplay = formatTime(remainingTime);

  const renderIdleState = () => (
    <>
        <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-background">
            <Mic className={`h-16 w-16 text-primary transition-all`} />
        </div>
        <div className="w-full max-w-xs">
            <Button size="lg" onClick={handleStartRecording} className="w-full">
                <Mic className="mr-2 h-5 w-5" />
                녹음 시작
            </Button>
        </div>
        <p className="text-sm text-muted-foreground">준비가 되면 "녹음 시작"을 클릭하세요.</p>
    </>
  );

  const renderRecordingState = () => (
    <>
        <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-background">
            <Mic className={`h-16 w-16 text-primary transition-all scale-110`} />
            <div className="absolute inset-0 rounded-full bg-destructive/20 animate-pulse"></div>
        </div>
        <div className="w-full max-w-xs">
            <Button size="lg" onClick={handleStopRecording} className="w-full" variant="destructive">
                <StopCircle className="mr-2 h-5 w-5" />
                녹음 중지
            </Button>
        </div>
        <p className="text-sm text-muted-foreground">답변을 마치면 "녹음 중지"를 클릭하세요.</p>
    </>
  );

  const renderRecordedState = () => (
     <Card className="w-full max-w-md bg-background">
        <CardHeader>
            <CardTitle>녹음 확인</CardTitle>
            <CardDescription>
                아래에서 녹음된 내용을 확인하고 제출하세요. {formatFileSize(audioSize)}
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {audioUrl && (
                <audio src={audioUrl} controls className="w-full" />
            )}
            <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleStartRecording} variant="outline" className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    다시 녹음하기
                </Button>
                <Button onClick={handleSubmit} className="w-full">
                    <Send className="mr-2 h-4 w-4" />
                    답변 제출하기
                </Button>
            </div>
        </CardContent>
     </Card>
  );
  
  const renderSubmittingState = () => (
    <>
        <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-background">
            <Loader2 className={`h-16 w-16 text-primary transition-all animate-spin`} />
        </div>
        <div className="w-full max-w-xs">
            <Button size="lg" disabled className="w-full">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                제출 중...
            </Button>
        </div>
        <p className="text-sm text-muted-foreground">답변을 서버로 전송하고 있습니다.</p>
    </>
  );

  const renderContent = () => {
    switch (recordingState) {
        case "recording": return renderRecordingState();
        case "recorded": return renderRecordedState();
        case "submitting": return renderSubmittingState();
        case "idle":
        default:
            return renderIdleState();
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8 border rounded-lg bg-muted/50 min-h-[350px] justify-center">
      {timeLimit && recordingState !== 'submitting' && (
        <div className={`flex items-center gap-2 text-lg font-semibold text-muted-foreground ${recordingState === 'recorded' ? 'mb-4' : ''}`}>
          <Timer className="h-6 w-6" />
          <span>{recordingState === 'recording' ? timerDisplay : formatTime(timeLimit)}</span>
        </div>
      )}
      {renderContent()}
    </div>
  )
}
