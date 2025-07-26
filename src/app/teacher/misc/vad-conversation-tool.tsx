
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, Bot, User, Play, Volume2, BrainCircuit, Loader2, StopCircle, RefreshCw, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type ConversationTurn } from "@/lib/types/ai-schemas";
import { converseWithNativeTeacher } from "@/ai/flows/create-native-teacher-flow"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

const SPEECH_END_TIMEOUT_MS = 4000; 

type SessionState = "idle" | "initializing" | "speaking" | "listening" | "processing" | "ending" | "finished";

export function VadConversationTool() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechEndTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  
  const { toast } = useToast();
  
  const cleanup = useCallback(() => {
    if (speechEndTimerRef.current) {
        clearTimeout(speechEndTimerRef.current);
    }
    if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }
  }, []);
  
  const startListening = useCallback(() => {
    setSessionState("listening");
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        toast({ title: "브라우저 지원 안함", description: "실시간 음성 인식을 지원하지 않는 브라우저입니다.", variant: "destructive"});
        setSessionState("idle");
        return;
    }
    
    cleanup();

    try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        const resetTimer = () => {
            if(speechEndTimerRef.current) clearTimeout(speechEndTimerRef.current);
            speechEndTimerRef.current = setTimeout(() => {
                if (recognitionRef.current) {
                     recognitionRef.current.stop();
                }
            }, SPEECH_END_TIMEOUT_MS);
        };

        recognition.onresult = (event) => {
            let tempInterim = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i][0].transcript) {
                    tempInterim += event.results[i][0].transcript;
                }
            }
            if(tempInterim.trim()){
              setInterimTranscript(tempInterim);
              resetTimer();
            }
        };
        
        recognition.onend = () => {
             // Only process if we are still in listening state.
            // This prevents race conditions if the user clicks "Stop"
            if (recognitionRef.current?.onend) { // Check if we are still 'alive'
                 processFinalTranscript(interimTranscript);
            }
        };

        recognition.onerror = (event) => {
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                toast({title: "음성 인식 오류", description: `오류가 발생했습니다: ${event.error}`, variant: "destructive"});
                 setSessionState("idle");
            }
        };
        
        recognition.start();

    } catch (err) {
        toast({ title: "마이크 오류", description: "마이크에 접근할 수 없습니다.", variant: "destructive" });
        setSessionState("idle");
    }
  }, [toast, cleanup]);


  const processFinalTranscript = useCallback(async (transcript: string) => {
    // If we are not in the listening state, it means user clicked stop, so we bail.
    if (sessionState !== 'listening') {
      return;
    }
    
    if (!transcript.trim()) {
      startListening(); 
      return; 
    }
    
    setSessionState("processing");
    const newHistory = [...conversation, {role: 'user', text: transcript}];
    setConversation(newHistory);
    setInterimTranscript("");
    
    try {
        const { aiResponseText, aiResponseAudioDataUri } = await converseWithNativeTeacher({
            studentTranscript: transcript.trim(),
            conversationHistory: newHistory,
        });

        setConversation(prev => [...prev, {role: 'model', text: aiResponseText}]);
        setSessionState("speaking");
        
        if (audioPlayerRef.current) {
            audioPlayerRef.current.src = aiResponseAudioDataUri;
            audioPlayerRef.current.play().catch(e => {
                console.error("Audio play error:", e);
                toast({title: "오디오 재생 오류", variant: "destructive"});
                startListening();
            });
        } else {
            // Failsafe in case audio player isn't ready
            startListening();
        }
    } catch (error) {
        toast({ title: "AI 처리 오류", variant: "destructive" });
        startListening();
    }
  }, [conversation, sessionState, toast, startListening]);


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
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [conversation, interimTranscript]);

  const startConversation = async () => {
    setConversation([]);
    setInterimTranscript("");
    setSessionState("initializing");
    try {
      const { aiResponseText, aiResponseAudioDataUri } = await converseWithNativeTeacher({
        studentTranscript: null,
        conversationHistory: [],
      });
      setConversation([{ role: 'model', text: aiResponseText }]);
      setSessionState("speaking");
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = aiResponseAudioDataUri;
        await audioPlayerRef.current.play().catch(e => {
            console.error("Audio play error:", e);
            toast({title: "오디오 재생 오류", variant: "destructive"});
            startListening();
        });
      }
    } catch (error) {
      toast({ title: "대화 시작 오류", variant: "destructive" });
      setSessionState("idle");
    }
  };

  const handleStopConversation = () => {
    setSessionState("ending");
    cleanup();
    if(interimTranscript.trim()){
         setConversation(prev => [...prev, {role: 'user', text: interimTranscript.trim()}]);
    }
    setInterimTranscript("");
    setSessionState("finished");
    toast({ title: "대화 종료됨" });
  }

  const handleReset = () => {
    setSessionState("idle");
    setConversation([]);
    setInterimTranscript("");
    cleanup();
  }

  const getButtonState = () => {
      if (sessionState === 'idle') {
          return <Button size="lg" onClick={startConversation} className="w-full"><Play className="mr-2"/>대화 시작</Button>
      }
      if (sessionState === 'finished') {
          return <Button size="lg" onClick={handleReset} variant="outline" className="w-full"><RefreshCw className="mr-2"/>새로 시작</Button>
      }
      return <Button size="lg" onClick={handleStopConversation} variant="destructive" className="w-full" disabled={sessionState==='ending'}><StopCircle className="mr-2"/>대화 종료</Button>
  }
  
  const getStatusText = () => {
    switch(sessionState) {
        case 'speaking': return "AI가 응답 중입니다...";
        case 'listening': return "네, 듣고 있어요. 편하게 말씀하세요...";
        case 'processing': return "답변을 처리하고 있습니다...";
        case 'initializing': return "AI가 첫 인사를 준비 중입니다...";
        case 'ending': return "대화를 종료하고 있습니다...";
        default: return "";
    }
  }

  const handleAudioEnded = () => {
      if (sessionState === 'speaking') {
          startListening();
      }
  };

  return (
    <div className="flex flex-col gap-4">
       <ScrollArea className="h-80 w-full rounded-md border">
        <div className="p-4 space-y-4" ref={scrollViewportRef}>
            {sessionState === "idle" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                  <BrainCircuit className="h-12 w-12 mb-4 text-primary"/>
                  <p className="font-semibold">'대화 시작'을 누르면 자동으로 대화가 진행됩니다.</p>
                  <p className="text-sm">의미있는 발화가 4초간 없으면 자동으로 AI에게 턴이 넘어갑니다.</p>
              </div>
            )}
             {sessionState === "finished" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-8">
                  <CheckCircle2 className="h-12 w-12 mb-4 text-green-500"/>
                  <p className="font-semibold">대화가 종료되었습니다.</p>
                  <p className="text-sm">위에서 전체 대화 내용을 확인하고, '새로 시작'을 눌러 다시 대화할 수 있습니다.</p>
              </div>
            )}
            {["initializing", "processing", "ending"].includes(sessionState) && (
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
             {interimTranscript && (sessionState === 'listening' || sessionState === 'processing') && (
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
            <Label htmlFor="sensitivity">마이크 민감도 (조용한 환경 🤫 &lt;-&gt; 🗣️ 시끄러운 환경)</Label>
            <Slider
                id="sensitivity"
                min={0.005}
                max={0.05}
                step={0.001}
                defaultValue={[0.01]}
                disabled={sessionState !== 'idle' && sessionState !== 'finished'}
            />
        </div>
        {getButtonState()}
        {sessionState !== 'idle' && sessionState !== 'finished' && (
            <p className={cn("text-xs text-center", sessionState === 'listening' ? "text-blue-600 font-semibold" : "text-muted-foreground")}>
                {getStatusText()}
            </p>
        )}
      </div>

      <audio ref={audioPlayerRef} onEnded={handleAudioEnded} className="hidden" />
    </div>
  );
}
