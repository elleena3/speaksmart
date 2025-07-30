
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2, Bot, User, CornerDownLeft, BrainCircuit, Play, Volume2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { converseWithStudent } from "@/ai/flows/text-to-speech"
import { type ConversationTurn } from "@/lib/types/ai-schemas";
import { type TeacherAssessment } from "@/lib/types";
import { useAuth } from "@/context/auth-context"

const SESSION_STORAGE_KEY = 'freeTalkSessionData';
const mimeType = 'audio/webm;codecs=opus';

type SessionState = "idle" | "initializing" | "countdown" | "recording" | "processing" | "speaking" | "waiting_for_user" | "submitting";

export function FreeTalkView({ assessment }: { assessment: TeacherAssessment }) {
  const { user } = useAuth();
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(2);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const studentAudioBlobsRef = useRef<Blob[]>([]); // To collect all student audio blobs
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  
  const router = useRouter();
  const { toast } = useToast();

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
    if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
    }
    audioChunksRef.current = [];
  }, []);

  useEffect(() => {
    // Clear history when component mounts for a clean start
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    // Cleanup on component unmount
    return () => {
      cleanupRecorder();
      if(audioPlayerRef.current){
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = "";
      }
    };
  }, [cleanupRecorder]);

  // Effect to show toast on recording start to avoid render errors
  useEffect(() => {
    if (sessionState === 'recording') {
        toast({ title: "녹음 시작됨", description: "말씀을 마치신 후 녹음 중지 버튼을 눌러주세요." });
    }
  }, [sessionState, toast]);

  useEffect(() => {
    // Scroll to the bottom of the conversation
    if (scrollAreaRef.current) {
        const scrollableView = scrollAreaRef.current.querySelector('div');
        if (scrollableView) {
            scrollableView.scrollTop = scrollableView.scrollHeight;
        }
    }
  }, [conversation, interimTranscript]);


  const startConversation = async () => {
    setSessionState("initializing");
    try {
      // Call the flow with no student input to get a greeting
      const { aiResponseText, aiResponseAudioDataUri } = await converseWithStudent({
        studentRecordingDataUri: null,
        conversationHistory: [],
        scenario: assessment.scenario,
        scenarioPrompt: assessment.prompt,
        aiVoice: assessment.aiVoice,
        evaluationModel: assessment.evaluationModel,
      });

      const initialTurn: ConversationTurn = { role: 'model', text: aiResponseText };
      setConversation([initialTurn]);

      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = aiResponseAudioDataUri;
        audioPlayerRef.current.play();
        setSessionState("speaking");
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
      toast({
        title: "대화 시작 오류",
        description: "AI와 대화를 시작하는 데 실패했습니다. 페이지를 새로고침해주세요.",
        variant: "destructive",
      });
      setSessionState("idle");
    }
  };

  const startActualRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        if (audioChunksRef.current.length === 0) {
            console.warn("No audio data recorded for this turn.");
            setInterimTranscript(null);
            setSessionState("waiting_for_user");
            toast({ title: "목소리가 들리지 않아요", description: "마이크를 확인하고 다시 말씀해주세요.", variant: "destructive" });
            cleanupRecorder();
            return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        studentAudioBlobsRef.current.push(audioBlob);
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => processAudio(reader.result as string);
        cleanupRecorder();
      };
      
      mediaRecorderRef.current.onerror = (event) => {
          console.error("MediaRecorder error:", event);
          toast({ title: "녹음 오류", description: "녹음 중 오류가 발생했습니다.", variant: "destructive" });
          setInterimTranscript(null);
          setSessionState("waiting_for_user");
          cleanupRecorder();
      };

      mediaRecorderRef.current.start(100);
      return true;

    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({ title: "마이크 접근 오류", description: "마이크 접근을 허용해주세요.", variant: "destructive" });
      setSessionState("waiting_for_user");
      setInterimTranscript(null);
      return false;
    }
  }, [cleanupRecorder, toast]);


  const handleStartRecording = async () => {
    if (sessionState !== 'waiting_for_user') return;
    
    setInterimTranscript(null);
    setSessionState("countdown");
    setCountdown(2);

    const recordingStarted = await startActualRecording();
    if (!recordingStarted) {
        setSessionState("waiting_for_user");
        return;
    }

    countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
            if (prev <= 1) {
                if(countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                setSessionState("recording");
                return 0;
            }
            return prev - 1;
        });
    }, 700);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      setSessionState("processing");
      setInterimTranscript("처리 중...");
      mediaRecorderRef.current.stop();
    }
  };

  const processAudio = async (studentRecordingDataUri: string) => {
    try {
      const { studentTranscript, aiResponseText, aiResponseAudioDataUri } = await converseWithStudent({
        studentRecordingDataUri,
        conversationHistory: conversation,
        scenario: assessment.scenario,
        scenarioPrompt: assessment.prompt,
        aiVoice: assessment.aiVoice,
        evaluationModel: assessment.evaluationModel,
      });
      
      setInterimTranscript(null);

      const userTurn: ConversationTurn = { role: 'user', text: studentTranscript };
      const modelTurn: ConversationTurn = { role: 'model', text: aiResponseText };
      
      setConversation(prev => [...prev, userTurn, modelTurn]);


      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = aiResponseAudioDataUri;
        audioPlayerRef.current.play();
        setSessionState("speaking");
      }
    } catch (error) {
      console.error("Error processing audio:", error);
      toast({
        title: "처리 오류",
        description: "오디오 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
      setInterimTranscript(null);
      setSessionState("waiting_for_user"); // Let user try again
    }
  };

  const handleFinishSession = async () => {
    if (studentAudioBlobsRef.current.length === 0 || !user) {
        toast({ title: "저장할 음성 없음", description: "대화를 먼저 진행해주세요.", variant: "destructive"});
        return;
    }
    setSessionState("submitting");
    
    try {
        const combinedBlob = new Blob(studentAudioBlobsRef.current, { type: mimeType });
        
        toast({ title: "대화 내용 처리 중...", description: "결과 분석 페이지로 이동합니다." });

        const reader = new FileReader();
        reader.readAsDataURL(combinedBlob);
        reader.onloadend = () => {
            const dataUri = reader.result as string;
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ 
                studentRecordingDataUri: dataUri,
                conversationHistory: conversation,
                assessment: assessment,
            }));
            
            router.push(`/student/assessment/free-talk/processing?id=${assessment.id}`);
        }
        
    } catch (error) {
        console.error("Error finalizing session:", error);
        toast({ title: "종료 오류", description: "대화를 종료하고 저장하는 중 오류가 발생했습니다.", variant: "destructive"});
        setSessionState("waiting_for_user");
    }
  }

  const getButtonState = () => {
    switch (sessionState) {
      case "idle":
        return (
          <Button size="lg" onClick={startConversation} className="w-full">
            <Play className="mr-2 h-5 w-5" />
            대화 시작
          </Button>
        );
      case "initializing":
      case "submitting":
        return (
          <Button size="lg" disabled className="w-full">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {sessionState === "initializing" ? "AI 준비 중..." : "제출 중..."}
          </Button>
        );
      case "countdown":
        return (
            <Button size="lg" disabled className="w-full">
                <Mic className="mr-2 h-5 w-5" />
                응답하기
            </Button>
        );
      case "recording":
        return (
          <Button size="lg" onClick={handleStopRecording} className="w-full" variant="destructive">
            <StopCircle className="mr-2 h-5 w-5" />
            말하기 중지
          </Button>
        );
      case "processing":
        return (
          <Button size="lg" disabled className="w-full">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            AI 생각 중...
          </Button>
        );
       case "speaking":
        return (
            <Button size="lg" disabled className="w-full">
                <Volume2 className="mr-2 h-5 w-5 animate-pulse" />
                AI 응답 중...
            </Button>
        );
       case "waiting_for_user":
        return (
          <Button size="lg" onClick={handleStartRecording} className="w-full">
            <Mic className="mr-2 h-5 w-5" />
            응답하기
          </Button>
        );
    }
  };

  const getFooterButtonState = () => {
    const isBusy = ["recording", "processing", "initializing", "speaking", "submitting", "countdown"].includes(sessionState);
    switch(sessionState) {
        case "idle":
            return (
                <Button onClick={() => router.push('/student/dashboard')} variant="secondary">
                    <CornerDownLeft className="mr-2 h-5 w-5"/>
                    나가기
                </Button>
            );
        default:
            return (
                <Button onClick={handleFinishSession} variant="secondary" disabled={isBusy || studentAudioBlobsRef.current.length === 0}>
                    <CornerDownLeft className="mr-2 h-5 w-5"/>
                    대화 종료
                </Button>
            );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <ScrollArea className="h-80 w-full rounded-md border p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
              {sessionState === "idle" && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                    <BrainCircuit className="h-12 w-12 mb-4 text-primary"/>
                    <p className="font-semibold">AI와 자유롭게 대화하며 영어 실력을 향상시키세요.</p>
                    <p className="text-sm">준비가 되면 아래 '대화 시작' 버튼을 눌러주세요.</p>
                </div>
              )}
              {["initializing", "submitting"].includes(sessionState) && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                    <Loader2 className="h-12 w-12 mb-4 animate-spin"/>
                    <p className="font-semibold">
                      {sessionState === 'initializing' ? `AI 대화 파트너 '${assessment.aiVoice || 'algenib'}'를 연결하는 중입니다...` : '대화 내용을 저장하고 분석 페이지로 이동합니다...'}
                    </p>
                    <p className="text-sm">잠시만 기다려주세요.</p>
                </div>
              )}
              {conversation.map((turn, index) => (
                <div key={index} className={`flex items-start gap-3 ${turn.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                   {turn.role === 'user' && (
                      <div className="p-2 rounded-full bg-muted">
                          <User className="h-5 w-5" />
                      </div>
                  )}
                  <div className={`p-3 rounded-lg max-w-[80%] ${turn.role === 'user' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                    <p className="text-sm">{turn.text}</p>
                  </div>
                   {turn.role === 'model' && (
                      <div className="p-2 rounded-full bg-primary text-primary-foreground">
                          <Bot className="h-5 w-5" />
                      </div>
                  )}
                </div>
              ))}
              {interimTranscript && (
                  <div className="flex items-start gap-3 justify-start">
                      <div className="p-2 rounded-full bg-muted">
                          <User className="h-5 w-5" />
                      </div>
                      <div className="p-3 rounded-lg max-w-[80%] bg-muted">
                          <p className="text-sm text-muted-foreground italic">{interimTranscript}</p>
                      </div>
                  </div>
              )}
          </div>
        </ScrollArea>
        {sessionState === 'countdown' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md z-10">
                <span className="text-8xl font-bold text-white animate-ping-short">{countdown}</span>
            </div>
        )}
      </div>
      
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
            <div className="flex-grow">
              {getButtonState()}
            </div>
            {getFooterButtonState()}
        </div>
        {sessionState !== 'idle' && sessionState !== 'initializing' && sessionState !== 'submitting' && sessionState !== 'countdown' && (
            <p className="text-base text-center text-muted-foreground">
                AI의 응답이 끝나면 <strong className="text-foreground">[응답하기]</strong> 버튼을 누르고 말씀하세요. 발언이 끝나면 <strong className="text-foreground">[말하기 중지]</strong> 버튼을 누릅니다.
            </p>
        )}
        {sessionState === 'countdown' && (
             <p className="text-base text-center text-muted-foreground">
                카운트다운 후 바로 말씀하세요!
            </p>
        )}
      </div>

      <audio ref={audioPlayerRef} onEnded={() => setSessionState("waiting_for_user")} className="hidden" />
    </div>
  );
}
