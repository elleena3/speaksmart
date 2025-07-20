
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2, Timer, Send, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { type TeacherAssessment } from "@/lib/types"
import { useAuth } from "@/context/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type RecordingState = "idle" | "countdown" | "recording" | "recorded" | "submitting";

const mimeType = 'audio/webm;codecs=opus';
const SESSION_STORAGE_KEY = 'monologueSessionData';


export function AssessmentView({ assessmentDetails }: { assessmentDetails: TeacherAssessment }) {
  const { user } = useAuth();
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSize, setAudioSize] = useState<number | null>(null);
  
  const router = useRouter()
  const { toast } = useToast()
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);


  const timeLimit = assessmentDetails.recordingTimeLimit && assessmentDetails.recordingTimeLimit > 0 
    ? assessmentDetails.recordingTimeLimit * 60 
    : null;

  // Effect to show toasts based on recording state changes
  useEffect(() => {
    if (recordingState === 'recorded') {
        toast({ title: "녹음 완료", description: "아래에서 녹음을 확인하고 제출해주세요." });
    } else if (recordingState === 'recording') {
        toast({ title: "녹음 시작됨", description: "말씀을 마치신 후 녹음 중지 버튼을 눌러주세요." });
    }
  }, [recordingState, toast]);

  // Effect to handle blob creation and URL generation
  useEffect(() => {
    if (audioBlob) {
      setAudioUrl(URL.createObjectURL(audioBlob));
      setAudioSize(audioBlob.size);
    } else {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
    }
    // Cleanup URL on unmount or when blob is cleared
    return () => {
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
    };
  }, [audioBlob]);

  const cleanupRecorder = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current = null;
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    recordedChunksRef.current = [];
  }, []);

  const onRecordingStop = useCallback(() => {
    if (recordedChunksRef.current.length === 0) {
        console.warn("No audio data recorded.");
        setAudioBlob(null);
        setRecordingState("idle");
    } else {
        const newAudioBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        setAudioBlob(newAudioBlob);
        setRecordingState("recorded");
    }
    cleanupRecorder();
  }, [cleanupRecorder]);


  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && (mediaRecorderRef.current.state === "recording" || mediaRecorderRef.current.state === "paused")) {
      mediaRecorderRef.current.stop(); // This will trigger the onstop event
    }
  }, []);

  const startActualRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = onRecordingStop;
      
      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        toast({ title: "녹음 오류", description: "녹음 중 오류가 발생했습니다.", variant: "destructive" });
        setRecordingState("idle");
        cleanupRecorder();
      };

      recorder.start(100);
      return true;

    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({ title: "마이크 접근 오류", description: "마이크 접근 권한을 허용해주세요.", variant: "destructive" });
      setRecordingState("idle");
      return false;
    }
  }, [onRecordingStop, cleanupRecorder, toast]);

  const handleStartRecording = async () => {
    setAudioBlob(null); // Clear previous recording
    setRecordingState("countdown");
    setCountdown(3);

    const recordingStarted = await startActualRecording();
    if (!recordingStarted) {
        setRecordingState("idle");
        return;
    }

    if (timeLimit) startTimer();

    countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
            if (prev <= 1) {
                clearInterval(countdownIntervalRef.current!);
                setRecordingState("recording");
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
  }

  const handleSubmit = async () => {
    if (!audioBlob || !user) {
        toast({ title: "오류", description: "제출할 오디오 파일이 없습니다.", variant: "destructive" });
        return;
    }
    setRecordingState("submitting");

    try {
        toast({ title: "답변 처리 중...", description: "AI 분석 페이지로 이동합니다." });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
            const dataUri = reader.result as string;
            // Remove any previous session data to ensure this new submission is processed
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            
            // Store all necessary data in session storage for the results page
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
                assessmentId: assessmentDetails.id,
                studentRecordingDataUri: dataUri, // Pass the audio as Data URI
                studentRecordingBlob: audioBlob, // Pass the blob for upload later
                assessmentDetails: assessmentDetails, 
            }));
    
            router.push(`/student/assessment/${assessmentDetails.id}/results`);
        };
        reader.onerror = (error) => {
             console.error("Error converting blob to data URI:", error);
             toast({ title: "파일 처리 오류", description: "녹음 파일을 처리하는 중 오류가 발생했습니다.", variant: "destructive" });
             setRecordingState("recorded");
        };

    } catch (error) {
        console.error("Error submitting audio:", error);
        toast({ title: "제출 오류", description: "답변을 제출하는 중 오류가 발생했습니다.", variant: "destructive" });
        setRecordingState("recorded"); // Allow user to try again
    }
  }
  
  useEffect(() => {
    if (remainingTime === 0 && mediaRecorderRef.current?.state === "recording") {
      handleStopRecording();
    }
  }, [remainingTime, handleStopRecording]);
  
  const startTimer = () => {
    if (timeLimit) {
      setRemainingTime(timeLimit);
      timerIntervalRef.current = setInterval(() => {
        setRemainingTime(prevTime => {
          if (prevTime === null || prevTime <= 1) {
            clearInterval(timerIntervalRef.current!);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
  };
  
  useEffect(() => {
    if (timeLimit) setRemainingTime(timeLimit);
    return () => cleanupRecorder();
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

  const renderCountdownState = () => (
    <>
        <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-background">
            <span className="text-7xl font-bold text-primary animate-ping-short">{countdown}</span>
        </div>
        <div className="w-full max-w-xs">
            <Button size="lg" disabled className="w-full" variant="destructive">
                <StopCircle className="mr-2 h-5 w-5" />
                녹음 중지
            </Button>
        </div>
        <p className="text-sm text-muted-foreground">카운트다운 후 바로 말씀하세요!</p>
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
                처리 중...
            </Button>
        </div>
        <p className="text-sm text-muted-foreground">AI 분석 페이지로 이동합니다.</p>
    </>
  );

  const renderContent = () => {
    switch (recordingState) {
        case "countdown": return renderCountdownState();
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
          <span>{['recording', 'countdown'].includes(recordingState) ? timerDisplay : formatTime(timeLimit)}</span>
        </div>
      )}
      {renderContent()}
    </div>
  )
}
