
"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2, Bot, User, CornerDownLeft, BrainCircuit } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { converseWithStudent } from "@/ai/flows/text-to-speech"
import { type ConversationHistory } from "@/lib/types"
import { type ConversationTurn } from "@/lib/types/ai-schemas";

const SESSION_STORAGE_KEY = 'freeTalkConversationHistory';

export function FreeTalkView() {
  const [sessionState, setSessionState] = useState<"idle" | "recording" | "processing" | "speaking">("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Clear history when component mounts to start a fresh session
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
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
          <Button size="lg" onClick={handleStartRecording} className="w-full">
            <Mic className="mr-2 h-5 w-5" />
            {conversation.length === 0 ? "대화 시작" : "응답하기"}
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
        {conversation.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <BrainCircuit className="h-12 w-12 mb-4"/>
              <p className="font-semibold">AI 대화 파트너 "Alex"입니다.</p>
              <p className="text-sm">준비가 되면 '대화 시작' 버튼을 눌러주세요.</p>
          </div>
        )}
        {conversation.map((turn, index) => (
          <div key={index} className={`flex items-start gap-3 ${turn.role === 'user' ? '' : 'flex-row-reverse'}`}>
            <div className={`p-2 rounded-full ${turn.role === 'user' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
              {turn.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
            </div>
            <div className={`p-3 rounded-lg max-w-[80%] ${turn.role === 'user' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
              <p className="text-sm">{turn.text}</p>
            </div>
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
