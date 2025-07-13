
"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2, Bot, User, CornerDownLeft, BrainCircuit } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { converseWithStudent } from "@/ai/flows/text-to-speech"
import { type ConversationTurn } from "@/lib/types/ai-schemas";

const SESSION_STORAGE_KEY = 'freeTalkConversationHistory';

export function FreeTalkView() {
  const [sessionState, setSessionState] = useState<"idle" | "recording" | "processing" | "speaking">("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Clear history and start conversation when component mounts
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    
    const startConversation = async () => {
      setSessionState("processing");
      setIsInitializing(true);
      try {
        // Call the flow with no student input to get a greeting
        const { aiResponseText, aiResponseAudioDataUri } = await converseWithStudent({
          studentRecordingDataUri: null, // No initial recording
          conversationHistory: [],
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
      } finally {
        setIsInitializing(false);
      }
    };

    startConversation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartRecording = async () => {
    setSessionState("recording");
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.start();
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "마이크 접근 오류",
        description: "마이크 접근을 허용해주세요.",
        variant: "destructive",
      });
      setSessionState("idle");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          processAudio(base64Audio);
        };
      };
      mediaRecorderRef.current.stop();
      setSessionState("processing");
    }
  };

  const processAudio = async (studentRecordingDataUri: string) => {
    try {
      const { studentTranscript, aiResponseText, aiResponseAudioDataUri } = await converseWithStudent({
        studentRecordingDataUri,
        conversationHistory: conversation,
      });

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
      setSessionState("idle");
    }
  };

  const handleFinishSession = () => {
    const fullTranscript = conversation.map(turn => `${turn.role === 'user' ? 'Student' : 'AI'}: ${turn.text}`).join('\n');
    
    // Store the final transcript in session storage to be picked up by the results page
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ history: conversation }));
    
    router.push('/student/assessment/free-talk/results');
  }

  const getButtonState = () => {
    switch (sessionState) {
      case "idle":
        return (
          <Button size="lg" onClick={handleStartRecording} className="w-full" disabled={isInitializing}>
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
      case "speaking":
        return (
          <Button size="lg" disabled className="w-full">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {sessionState === "processing" ? "AI 생각 중..." : "AI 말하는 중..."}
          </Button>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ScrollArea className="h-80 w-full rounded-md border p-4 space-y-4">
        {isInitializing && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Loader2 className="h-12 w-12 mb-4 animate-spin"/>
              <p className="font-semibold">AI 대화 파트너 "Alex"를 연결하는 중입니다...</p>
              <p className="text-sm">잠시만 기다려주세요.</p>
          </div>
        )}
        {!isInitializing && conversation.map((turn, index) => (
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
      </ScrollArea>
      
      <div className="flex gap-2">
        <div className="flex-grow">
          {getButtonState()}
        </div>
        <Button onClick={handleFinishSession} variant="secondary" disabled={conversation.length === 0 || sessionState !== 'idle'}>
          <CornerDownLeft className="mr-2 h-5 w-5"/>
          대화 종료
        </Button>
      </div>

      <audio ref={audioPlayerRef} onEnded={() => setSessionState("idle")} className="hidden" />
    </div>
  );
}
