
"use client"

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Bot, User, Play, Volume2, BrainCircuit, Loader2, StopCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type ConversationTurn } from "@/lib/types/ai-schemas";
import { converseWithSpeculativeTeacher } from "@/ai/flows/create-speculative-teacher-flow";
import { cn } from "@/lib/utils";

const mimeType = 'audio/webm;codecs=opus';
const SPEECH_END_TIMEOUT_MS = 2500; // 2.5 seconds of silence

type SessionState = "idle" | "initializing" | "speaking" | "listening" | "processing" | "ending" | "finished";

export function SpeculativeConversationTool() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
    if (speechRecognitionRef.current) {
        speechRecognitionRef.current.onresult = null;
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.onerror = null;
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current = null;
    }
    audioChunksRef.current = [];
    setInterimTranscript("");
  }, []);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    setSessionState("processing");
    setInterimTranscript("처리 중...");
    
    // Create initial chunk for speculation
    const initialChunkBlob = new Blob(audioChunksRef.current.slice(0, 10), { type: mimeType });
    
    const [initialChunkDataUri, finalAudioDataUri] = await Promise.all([
        new Promise<string>(resolve => {
            if (initialChunkBlob.size === 0) { resolve(""); return; }
            const reader = new FileReader();
            reader.readAsDataURL(initialChunkBlob);
            reader.onloadend = () => resolve(reader.result as string);
        }),
        new Promise<string>(resolve => {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => resolve(reader.result as string);
        }),
    ]);
    
    try {
        const { finalStudentTranscript, aiResponseText, aiResponseAudioDataUri } = await converseWithSpeculativeTeacher({
            initialChunkDataUri: initialChunkDataUri || undefined,
            finalAudioDataUri: finalAudioDataUri,
            conversationHistory: conversation,
        });

        const newHistory: ConversationTurn[] = [
            ...conversation,
            { role: 'user', text: finalStudentTranscript },
            { role: 'model', text: aiResponseText },
        ];
        setConversation(newHistory);
        setInterimTranscript("");
        setSessionState("speaking");

        if (audioPlayerRef.current) {
            audioPlayerRef.current.src = aiResponseAudioDataUri;
            await audioPlayerRef.current.play().catch(() => {
                 toast({ title: "오디오 재생 오류", variant: "destructive" });
                 (window as any)._startListeningVAD?.(); // Fallback to listening
            });
        }
    } catch(err) {
        toast({ title: "AI 처리 오류", description: (err as Error).message, variant: "destructive" });
        setSessionState('speaking'); // Let user try again by speaking
    }

  }, [conversation, toast]);
  

  const startListeningVAD = useCallback(() => {
    setSessionState("listening");
    setInterimTranscript(""); // Clear previous interim transcript
    cleanup();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        toast({ title: "브라우저 지원 안함", variant: "destructive"});
        setSessionState("idle");
        return;
    }

    try {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            // Start MediaRecorder
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 16000 });
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = () => {
                const fullAudioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                if (fullAudioBlob.size > 0) {
                    processAudio(fullAudioBlob);
                } else {
                    setSessionState('speaking'); // Go back to AI turn if no audio
                }
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorderRef.current.start(100);

            // Start SpeechRecognition
            const recognition = new SpeechRecognition();
            speechRecognitionRef.current = recognition;
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            
            const resetSilenceTimer = () => {
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                    if (speechRecognitionRef.current) {
                        speechRecognitionRef.current.stop(); // This will trigger onend
                    }
                }, SPEECH_END_TIMEOUT_MS);
            };

            recognition.onresult = (event) => {
                let interim = "";
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                     interim += event.results[i][0].transcript;
                }
                setInterimTranscript(interim);
                if (interim) {
                    resetSilenceTimer();
                }
            };
            
            recognition.onend = () => {
                 if (mediaRecorderRef.current?.state === 'recording') {
                    mediaRecorderRef.current.stop(); // This triggers processAudio
                }
            }

            recognition.onerror = (event) => {
                if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    toast({title: "음성 인식 오류", description: `오류: ${event.error}`, variant: "destructive"});
                    setSessionState("idle");
                }
            };

            recognition.start();
            resetSilenceTimer(); // Start initial timer
            
        }).catch(err => {
            toast({ title: "마이크 오류", variant: "destructive" });
            setSessionState("idle");
        });
    } catch (err) {
        toast({ title: "음성 인식 시작 오류", variant: "destructive" });
        setSessionState("idle");
    }
  }, [cleanup, processAudio, toast]);

  useEffect(() => {
    (window as any)._startListeningVAD = startListeningVAD;
    return () => { delete (window as any)._startListeningVAD; }
  }, [startListeningVAD]);
  
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startConversation = async () => {
    setConversation([]);
    setSessionState("initializing");
    try {
      const { aiResponseText, aiResponseAudioDataUri } = await converseWithSpeculativeTeacher({ isInitialGreeting: true, conversationHistory: [] });
      setConversation([{ role: 'model', text: aiResponseText }]);
      setSessionState("speaking");
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = aiResponseAudioDataUri;
        await audioPlayerRef.current.play().catch(e => {
            toast({ title: "오디오 재생 오류", variant: "destructive" });
            startListeningVAD();
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
          startListeningVAD();
      }
  };

  const getButtonState = () => {
    switch(sessionState) {
        case 'idle': return <Button size="lg" onClick={startConversation} className="w-full"><Play className="mr-2"/>대화 시작</Button>;
        case 'finished': return <Button size="lg" onClick={handleReset} variant="outline" className="w-full"><RefreshCw className="mr-2"/>새로 시작</Button>;
        default: return <Button size="lg" onClick={handleStopConversation} variant="destructive" className="w-full" disabled={sessionState==='ending' || sessionState==='initializing' || sessionState==='processing'}><StopCircle className="mr-2"/>대화 종료</Button>
    }
  }
  
   const getStatusIndicator = () => {
      switch(sessionState) {
        case 'speaking': return <div className="flex items-center gap-2 text-sm font-medium"><Volume2 className="h-5 w-5 text-green-500 animate-pulse"/><span>AI 응답 중...</span></div>
        case 'listening': return <div className="flex items-center gap-2 text-sm font-medium"><Mic className="h-5 w-5 text-blue-500 animate-pulse"/><span>듣는 중...</span></div>
        case 'processing': 
        case 'initializing': 
        case 'ending':
           return <div className="flex items-center gap-2 text-sm font-medium"><Loader2 className="h-5 w-5 animate-spin"/><span>처리 중...</span></div>
        default: return null
      }
  }


  return (
    <div className="flex flex-col gap-4">
      <ScrollArea className="h-80 w-full rounded-md border">
        <div className="p-4 space-y-4" ref={scrollViewportRef}>
            {sessionState === "idle" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                  <BrainCircuit className="h-12 w-12 mb-4 text-purple-500"/>
                  <p className="font-semibold">'대화 시작'을 누르면 자동으로 대화가 진행됩니다.</p>
                  <p className="text-sm">침묵이 감지되면 자동으로 턴이 넘어갑니다.</p>
              </div>
            )}
            {sessionState === "finished" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-8">
                  <CheckCircle2 className="h-12 w-12 mb-4 text-green-500"/>
                  <p className="font-semibold">대화가 종료되었습니다.</p>
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center gap-4 h-10">
            <div className="flex-grow">
                 {getButtonState()}
            </div>
            <div className="w-32 text-center">
                 {getStatusIndicator()}
            </div>
        </div>
      </div>

      <audio ref={audioPlayerRef} onEnded={handleAudioEnded} className="hidden" />
    </div>
  );
}
