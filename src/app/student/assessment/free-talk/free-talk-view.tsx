
"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2, Bot, User, CornerDownLeft, BrainCircuit, Play, Volume2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { converseWithStudent } from "@/ai/flows/text-to-speech"
import { type ConversationTurn } from "@/lib/types/ai-schemas";
import { type Scenario, type TeacherAssessment } from "@/lib/types";

const SESSION_STORAGE_KEY = 'freeTalkSessionData';

export function FreeTalkView({ scenario, scenarioPrompt, assessment }: { scenario: Scenario, scenarioPrompt?: string, assessment: TeacherAssessment }) {
  const [sessionState, setSessionState] = useState<"idle" | "initializing" | "recording" | "processing" | "speaking" | "waiting_for_user">("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const studentAudioBlobsRef = useRef<Blob[]>([]); // To collect all student audio blobs
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  
  const router = useRouter();
  const { toast } = useToast();

  const cleanupRecorder = () => {
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
  }, []);

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
        scenario: scenario,
        scenarioPrompt: scenarioPrompt,
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


  const handleStartRecording = async () => {
    if (sessionState !== 'waiting_for_user') return;
    
    cleanupRecorder();
    setSessionState("recording");
    setInterimTranscript("듣고 있어요...");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, { 
        mimeType: 'video/webm',
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        if (audioChunksRef.current.length === 0) {
            console.warn("No audio data recorded for this turn.");
            setInterimTranscript(null);
            setSessionState("waiting_for_user");
            toast({
                title: "목소리가 들리지 않아요",
                description: "마이크를 확인하고 다시 말씀해주세요.",
                variant: "destructive"
            });
            cleanupRecorder();
            return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: 'video/webm' });
        studentAudioBlobsRef.current.push(audioBlob); // Collect the student's audio chunk
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          processAudio(base64Audio);
        };
        cleanupRecorder();
      };
      
      mediaRecorderRef.current.onerror = (event) => {
          console.error("MediaRecorder error:", event);
          toast({
              title: "녹음 오류",
              description: "녹음 중 오류가 발생했습니다. 다시 시도해주세요.",
              variant: "destructive",
          });
          setInterimTranscript(null);
          setSessionState("waiting_for_user");
          cleanupRecorder();
      };

      mediaRecorderRef.current.start();

    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "마이크 접근 오류",
        description: "마이크 접근을 허용해주세요.",
        variant: "destructive",
      });
      setSessionState("waiting_for_user");
      setInterimTranscript(null);
    }
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
        scenario: scenario,
        scenarioPrompt: scenarioPrompt,
      });
      
      setInterimTranscript(null);

      const newConversation: ConversationTurn[] = [
        ...conversation,
        { role: 'user', text: studentTranscript },
        { role: 'model', text: aiResponseText },
      ];
      setConversation(newConversation);

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

  const handleFinishSession = () => {
    // Combine all student audio blobs into one blob
    if (studentAudioBlobsRef.current.length === 0) {
        toast({
            title: "저장할 음성 없음",
            description: "대화를 먼저 진행해주세요.",
            variant: "destructive"
        });
        return;
    }
    const combinedBlob = new Blob(studentAudioBlobsRef.current, { type: 'video/webm' });
    const reader = new FileReader();
    reader.readAsDataURL(combinedBlob);
    reader.onloadend = () => {
        const studentRecordingDataUri = reader.result as string;
        
        sessionStorage.setItem('freeTalkSessionData', JSON.stringify({ 
            studentRecordingDataUri: studentRecordingDataUri,
            conversationHistory: conversation,
            assessment: assessment,
        }));
        
        router.push(`/student/assessment/free-talk/results`);
    };
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
        return (
          <Button size="lg" disabled className="w-full">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            AI 준비 중...
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
    const isBusy = ["recording", "processing", "initializing", "speaking"].includes(sessionState);
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
      <ScrollArea className="h-80 w-full rounded-md border p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
            {sessionState === "idle" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                  <BrainCircuit className="h-12 w-12 mb-4 text-primary"/>
                  <p className="font-semibold">AI와 자유롭게 대화하며 영어 실력을 향상시키세요.</p>
                  <p className="text-sm">준비가 되면 아래 '대화 시작' 버튼을 눌러주세요.</p>
              </div>
            )}
            {sessionState === "initializing" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                  <Loader2 className="h-12 w-12 mb-4 animate-spin"/>
                  <p className="font-semibold">AI 대화 파트너 "Alex"를 연결하는 중입니다...</p>
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
      
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
            <div className="flex-grow">
              {getButtonState()}
            </div>
            {getFooterButtonState()}
        </div>
        {sessionState !== 'idle' && sessionState !== 'initializing' && (
            <p className="text-xs text-center text-muted-foreground">
                AI의 응답이 끝나면 <strong className="text-foreground">[응답하기]</strong> 버튼을 누르고 말씀하세요. 발언이 끝나면 <strong className="text-foreground">[말하기 중지]</strong> 버튼을 누릅니다.
            </p>
        )}
      </div>

      <audio ref={audioPlayerRef} onEnded={() => setSessionState("waiting_for_user")} className="hidden" />
    </div>
  );
}
