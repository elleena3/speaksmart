
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, Bot, User, Play, Volume2, BrainCircuit, Loader2, StopCircle, RefreshCw, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type ConversationTurn } from "@/lib/types/ai-schemas";
import { converseWithHybridTeacher } from "@/ai/flows/create-hybrid-teacher-flow"
import { cn } from "@/lib/utils"

const mimeType = 'audio/webm;codecs=opus';
const SPEECH_END_TIMEOUT_MS = 2500; 

type SessionState = "idle" | "initializing" | "speaking" | "listening" | "processing" | "ending" | "finished";

export function HybridConversationTool() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechEndTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const finalTranscriptRef = useRef("");

  const cleanup = useCallback(() => {
    if (speechEndTimerRef.current) clearTimeout(speechEndTimerRef.current);
    if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }
     if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
    finalTranscriptRef.current = "";
    setInterimTranscript("");
  }, []);

  const processAudioBlob = useCallback(async (audioBlob: Blob) => {
    setSessionState("processing");
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
        const audioDataUri = reader.result as string;
        try {
            // The server now does STT, so we use its transcript as the source of truth
            const { studentTranscript, aiResponseText, aiResponseAudioDataUri } = await converseWithHybridTeacher({
                studentRecordingDataUri: audioDataUri,
                conversationHistory: conversation,
            });
            
            setConversation(prev => [...prev, {role: 'user', text: studentTranscript}, {role: 'model', text: aiResponseText}]);
            setSessionState("speaking");

            if (audioPlayerRef.current) {
                audioPlayerRef.current.src = aiResponseAudioDataUri;
                await audioPlayerRef.current.play().catch(e => {
                    toast({ title: "오디오 재생 오류", variant: "destructive" });
                    (window as any)._startListening();
                });
            } else {
                 (window as any)._startListening();
            }

        } catch (error) {
            toast({ title: "AI 처리 오류", variant: "destructive" });
            (window as any)._startListening();
        }
    };
  }, [conversation, toast]);
  

  const startListening = useCallback(() => {
    setSessionState("listening");
    finalTranscriptRef.current = "";
    setInterimTranscript("");
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        toast({ title: "브라우저 지원 안함", variant: "destructive"});
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
            if (speechEndTimerRef.current) clearTimeout(speechEndTimerRef.current);
            speechEndTimerRef.current = setTimeout(() => {
                if (recognitionRef.current) recognitionRef.current.stop();
            }, SPEECH_END_TIMEOUT_MS);
        };

        recognition.onresult = (event) => {
            let currentInterim = "";
            let localFinal = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                 if (event.results[i].isFinal) {
                    localFinal += event.results[i][0].transcript;
                } else {
                    currentInterim += event.results[i][0].transcript;
                }
            }
            finalTranscriptRef.current = localFinal;
            setInterimTranscript(localFinal + currentInterim);
            resetTimer();
        };

        recognition.onend = () => {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };

        recognition.onerror = (event) => {
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                toast({title: "음성 인식 오류", description: `오류: ${event.error}`, variant: "destructive"});
                 setSessionState("idle");
            }
        };
        
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.ondataavailable = (e) => {
                 if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                if (audioChunksRef.current.length > 0) {
                    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                    processAudioBlob(audioBlob);
                }
                 stream.getTracks().forEach(track => track.stop());
            }

            mediaRecorderRef.current.start();
            recognition.start();
            resetTimer();
        }).catch(err => {
             toast({ title: "마이크 오류", variant: "destructive" });
             setSessionState("idle");
        });
        

    } catch (err) {
        toast({ title: "음성 인식 시작 오류", variant: "destructive" });
        setSessionState("idle");
    }
  }, [toast, cleanup, processAudioBlob]);
  
   useEffect(() => {
    (window as any)._startListening = startListening;
    return () => {
        delete (window as any)._startListening;
    }
  }, [startListening]);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [conversation]);

  const startConversation = async () => {
    setConversation([]);
    setInterimTranscript("");
    setSessionState("initializing");
    try {
      const { aiResponseText, aiResponseAudioDataUri } = await converseWithHybridTeacher({
        studentRecordingDataUri: null,
        conversationHistory: [],
      });
      setConversation([{ role: 'model', text: aiResponseText }]);
      setSessionState("speaking");
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = aiResponseAudioDataUri;
        await audioPlayerRef.current.play().catch(e => {
            toast({ title: "오디오 재생 오류", variant: "destructive" });
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
    setSessionState("finished");
    toast({ title: "대화 종료됨" });
  }

  const handleReset = () => {
    setSessionState("idle");
    setConversation([]);
    setInterimTranscript("");
    cleanup();
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
                  <p className="text-sm">VAD(음성 활동 감지)로 사용자 발화를 자동으로 인식합니다.</p>
              </div>
            )}
             {sessionState === "finished" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-8">
                  <CheckCircle2 className="h-12 w-12 mb-4 text-green-500"/>
                  <p className="font-semibold">대화가 종료되었습니다.</p>
              </div>
            )}
            {["initializing", "processing", "ending"].includes(sessionState) && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                     <Loader2 className="h-12 w-12 mb-4 animate-spin"/>
                     <p className="font-semibold">
                         {sessionState === 'initializing' ? 'AI가 첫 인사를 준비 중입니다...' : sessionState === 'processing' ? '답변을 처리하고 있습니다...' : '대화를 종료하고 있습니다...'}
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
        <div className="flex items-center justify-center gap-4 h-10">
            {sessionState === 'idle' && <Button size="lg" onClick={startConversation} className="w-full"><Play className="mr-2"/>대화 시작</Button>}
            {sessionState === 'finished' && <Button size="lg" onClick={handleReset} variant="outline" className="w-full"><RefreshCw className="mr-2"/>새로 시작</Button>}
            {['listening', 'speaking', 'processing', 'initializing', 'ending'].includes(sessionState) && (
                <>
                    <div className="flex items-center gap-2 text-sm font-medium">
                        {sessionState === 'listening' && <><Mic className="h-5 w-5 text-blue-500 animate-pulse"/><span>듣는 중...</span></>}
                        {sessionState === 'speaking' && <><Volume2 className="h-5 w-5 text-green-500 animate-pulse"/><span>AI 응답 중...</span></>}
                        {(sessionState === 'processing' || sessionState === 'initializing' || sessionState === 'ending') && <><Loader2 className="h-5 w-5 animate-spin"/><span>처리 중...</span></>}
                    </div>
                    <Button size="lg" onClick={handleStopConversation} variant="destructive" className="w-full" disabled={sessionState==='ending' || sessionState === 'initializing' || sessionState === 'processing'}><StopCircle className="mr-2"/>대화 종료</Button>
                </>
            )}
        </div>
      </div>

      <audio ref={audioPlayerRef} onEnded={handleAudioEnded} className="hidden" />
    </div>
  );
}
