"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2, Bot, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

type Message = {
  speaker: "ai" | "user";
  text: string;
};

const TOTAL_TIME = 180; // 3 minutes in seconds

export function FreeTalkView() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const router = useRouter()
  const { toast } = useToast()
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setHasCameraPermission(true);
      } catch (error) {
        console.error('Error accessing media devices:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: '마이크 접근 거부됨',
          description: '이 기능을 사용하려면 브라우저 설정에서 마이크 권한을 허용해주세요.',
        });
      }
    };

    getCameraPermission();
  }, [toast]);
  
  useEffect(() => {
    if (isSessionActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft <= 0 && isSessionActive) {
      handleEndSession();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSessionActive, timeLeft]);

  const handleStartSession = () => {
    setIsSessionActive(true);
    setConversation([{ speaker: "ai", text: "Hello! My name is Alex. What's your name?" }]);
    // Here, you would call TTS for the AI's first line and play it.
    // For now, we just display the text.
  };

  const handleEndSession = () => {
    setIsSessionActive(false);
    if(timerRef.current) clearInterval(timerRef.current);
    setIsProcessing(true);
    toast({
      title: "대화 종료됨",
      description: "대화 내용을 분석 중입니다...",
    });

    // Simulate analysis and redirect
    setTimeout(() => {
      router.push(`/student/assessment/4/results`); // Redirect to a sample result page
    }, 2000);
  };
  
  const handleStartRecording = () => {
    setIsRecording(true);
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    // Simulate user speaking and AI response
    setConversation(prev => [...prev, { speaker: "user", text: "My name is... (simulated)" }]);
    
    setTimeout(() => {
        const aiResponses = [
            "That's a nice name! How are you today?",
            "Interesting. What are your hobbies?",
            "I see. Tell me more about that.",
            "That sounds fun! What did you do yesterday?"
        ];
        const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
        setConversation(prev => [...prev, { speaker: "ai", text: randomResponse }]);
    }, 1500);
  };

  if (!hasCameraPermission) {
    return (
      <Alert variant="destructive">
        <AlertTitle>마이크 접근 필요</AlertTitle>
        <AlertDescription>
          이 평가를 진행하려면 마이크 접근을 허용해야 합니다. 브라우저 설정에서 권한을 확인해주세요.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-4 border rounded-lg bg-muted/50">
      {!isSessionActive ? (
        <Button size="lg" onClick={handleStartSession}>
          대화 시작하기
        </Button>
      ) : (
        <>
          <div className="w-full space-y-2">
            <div className="flex justify-between font-mono text-sm">
                <span>남은 시간</span>
                <span>{Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}</span>
            </div>
            <Progress value={(TOTAL_TIME - timeLeft) / TOTAL_TIME * 100} className="w-full" />
          </div>

          <div className="w-full h-64 p-4 overflow-y-auto bg-background rounded-md space-y-4">
            {conversation.map((msg, index) => (
              <div key={index} className={`flex items-start gap-3 ${msg.speaker === 'ai' ? '' : 'justify-end'}`}>
                {msg.speaker === 'ai' && <Bot className="w-6 h-6 text-primary shrink-0" />}
                <div className={`rounded-lg px-3 py-2 max-w-xs ${msg.speaker === 'ai' ? 'bg-primary/10' : 'bg-secondary'}`}>
                  <p className="text-sm">{msg.text}</p>
                </div>
                {msg.speaker === 'user' && <User className="w-6 h-6 text-foreground shrink-0" />}
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-4">
            {isRecording ? (
              <Button size="lg" onClick={handleStopRecording} variant="destructive">
                <StopCircle className="mr-2 h-5 w-5" />
                말하기 중지
              </Button>
            ) : (
              <Button size="lg" onClick={handleStartRecording} disabled={isProcessing}>
                 {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Mic className="mr-2 h-5 w-5" />}
                 {isProcessing ? '처리중...' : '누르고 말하기'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleEndSession} disabled={isProcessing}>
                대화 종료
            </Button>
          </div>
        </>
      )}
      <audio ref={audioRef} hidden />
    </div>
  );
}
