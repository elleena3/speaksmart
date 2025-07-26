
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, Bot, User, Play, Volume2, BrainCircuit, Loader2, StopCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type ConversationTurn } from "@/lib/types/ai-schemas";
import { converseWithNativeTeacher } from "@/ai/flows/create-native-teacher-flow"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

const SILENCE_DURATION_MS = 2000; 

type SessionState = "idle" | "initializing" | "speaking" | "listening" | "processing" | "ending";

export function VadConversationTool() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [finalTranscript, setFinalTranscript] = useState<string>("");
  
  const [silenceThreshold, setSilenceThreshold] = useState(0.03);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  
  const { toast } = useToast();

  const cleanup = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      if(audioPlayerRef.current){
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = "";
      }
    };
  }, [cleanup]);

  useEffect(() => {
    if (scrollAreaRef.current) {
        const scrollableView = scrollAreaRef.current.querySelector('div');
        if (scrollableView) {
            scrollableView.scrollTop = scrollableView.scrollHeight;
        }
    }
  }, [conversation, interimTranscript]);

  const processFinalTranscript = useCallback(async (transcript: string) => {
    if (sessionState === 'ending' || !transcript.trim()) {
        startListening(); // Just listen again if nothing was said.
        return;
    }
    
    setSessionState("processing");
    // Add user's final transcript to conversation immediately
    const userTurn: ConversationTurn = {role: 'user', text: transcript};
    setConversation(prev => [...prev, userTurn]);
    setInterimTranscript("");
    
    try {
        const { aiResponseText, aiResponseAudioDataUri } = await converseWithNativeTeacher({
            studentTranscript: transcript,
            conversationHistory: [...conversation, userTurn], // Pass the updated conversation history
        });

        setConversation(prev => [...prev, {role: 'model', text: aiResponseText}]);
        
        if (audioPlayerRef.current) {
            audioPlayerRef.current.src = aiResponseAudioDataUri;
            audioPlayerRef.current.play();
            setSessionState("speaking");
        }
    } catch (error) {
        toast({ title: "AI 처리 오류", variant: "destructive" });
        startListening(); // Go back to listening if AI fails
    }
  }, [conversation, sessionState, toast]);

  const startListening = useCallback(() => {
    if (sessionState === 'ending') return;
    setSessionState("listening");
    setFinalTranscript("");
    setInterimTranscript("");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        toast({ title: "브라우저 지원 안함", description: "실시간 음성 인식을 지원하지 않는 브라우저입니다.", variant: "destructive"});
        setSessionState("idle");
        return;
    }
    
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                final += event.results[i][0].transcript;
            } else {
                interim += event.results[i][0].transcript;
            }
        }
        setInterimTranscript(interim);
        if (final.trim()) {
            setFinalTranscript(prev => prev + " " + final.trim());
        }

        if(silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
             if (recognitionRef.current) {
                recognitionRef.current.stop();
             }
        }, SILENCE_DURATION_MS);
    };
    
    recognitionRef.current.onend = () => {
        const finalTranscriptToProcess = (finalTranscript + " " + interimTranscript).trim();
        if(sessionState !== 'ending' && finalTranscriptToProcess){
            processFinalTranscript(finalTranscriptToProcess);
        } else if (sessionState === 'listening') {
             if (recognitionRef.current) recognitionRef.current.start();
        }
    };

    recognitionRef.current.onerror = (event) => {
        console.error("SpeechRecognition error", event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
            toast({title: "음성 인식 오류", description: `오류가 발생했습니다: ${event.error}`, variant: "destructive"});
        }
    };
    
    recognitionRef.current.start();

  }, [sessionState, toast, finalTranscript, processFinalTranscript, interimTranscript]);

  const startConversation = async () => {
    setConversation([]);
    setInterimTranscript("");
    setFinalTranscript("");
    setSessionState("initializing");
    try {
      const { aiResponseText, aiResponseAudioDataUri } = await converseWithNativeTeacher({
        studentTranscript: null,
        conversationHistory: [],
      });
      setConversation([{ role: 'model', text: aiResponseText }]);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = aiResponseAudioDataUri;
        audioPlayerRef.current.play();
        setSessionState("speaking");
      }
    } catch (error) {
      toast({ title: "대화 시작 오류", variant: "destructive" });
      setSessionState("idle");
    }
  };

  const handleStopConversation = () => {
    setSessionState("ending");
    cleanup();
    setSessionState("idle");
    setInterimTranscript("");
    setFinalTranscript("");
    toast({ title: "대화 종료됨" });
  }

  const getButtonState = () => {
      if (sessionState === 'idle') {
          return <Button size="lg" onClick={startConversation} className="w-full"><Play className="mr-2"/>대화 시작</Button>
      }
      return <Button size="lg" onClick={handleStopConversation} variant="destructive" className="w-full"><StopCircle className="mr-2"/>대화 종료</Button>
  }
  
  const getStatusText = () => {
    switch(sessionState) {
        case 'speaking': return "AI가 응답 중입니다...";
        case 'listening': return "네, 듣고 있어요. 편하게 말씀하세요...";
        case 'processing': return "답변을 처리하고 있습니다...";
        case 'initializing': return "AI가 첫 인사를 준비 중입니다...";
        default: return "";
    }
  }


  return (
    <div className="flex flex-col gap-4">
      <ScrollArea className="h-80 w-full rounded-md border p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
            {sessionState === "idle" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                  <BrainCircuit className="h-12 w-12 mb-4 text-primary"/>
                  <p className="font-semibold">'대화 시작'을 누르면 자동으로 대화가 진행됩니다.</p>
                  <p className="text-sm">말을 멈추면(약 2초) 자동으로 AI에게 턴이 넘어갑니다.</p>
              </div>
            )}
            {["initializing", "processing"].includes(sessionState) && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                     <Loader2 className="h-12 w-12 mb-4 animate-spin"/>
                     <p className="font-semibold">
                         {getStatusText()}
                     </p>
                 </div>
            )}
            {conversation.map((turn, index) => (
              <div key={index} className={cn("flex items-start gap-3", turn.role === 'user' ? 'justify-start' : 'justify-end')}>
                 {turn.role === 'user' && <div className="p-2 rounded-full bg-muted"><User className="h-5 w-5" /></div>}
                 <div className={cn("p-3 rounded-lg max-w-[80%]", turn.role === 'user' ? 'bg-muted' : 'bg-primary text-primary-foreground')}>
                   <p className="text-sm">{turn.text}</p>
                 </div>
                 {turn.role === 'model' && <div className="p-2 rounded-full bg-primary text-primary-foreground"><Bot className="h-5 w-5" /></div>}
              </div>
            ))}
             {interimTranscript && (
                <div className="flex items-start gap-3 justify-start">
                    <div className="p-2 rounded-full bg-muted"><User className="h-5 w-5" /></div>
                    <div className="p-3 rounded-lg max-w-[80%] bg-muted">
                        <p className="text-sm text-muted-foreground italic">{interimTranscript}</p>
                    </div>
                </div>
            )}
        </div>
      </ScrollArea>
      
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
            <Label htmlFor="mic-sensitivity" className="text-xs">마이크 민감도 (오른쪽으로 갈수록 둔감)</Label>
            <Slider
                id="mic-sensitivity"
                min={0.01}
                max={0.1}
                step={0.01}
                value={[silenceThreshold]}
                onValueChange={(value) => setSilenceThreshold(value[0])}
                disabled={sessionState !== 'idle'}
            />
        </div>
        {getButtonState()}
        {sessionState !== 'idle' && (
            <p className={cn("text-xs text-center", sessionState === 'listening' ? "text-blue-600 font-semibold" : "text-muted-foreground")}>
                {getStatusText()}
            </p>
        )}
      </div>

      <audio ref={audioPlayerRef} onEnded={startListening} className="hidden" />
    </div>
  );
}
