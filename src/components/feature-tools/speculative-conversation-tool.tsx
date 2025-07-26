
"use client"

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Bot, User, Play, Volume2, BrainCircuit, Loader2, StopCircle, RefreshCw, CheckCircle2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type ConversationTurn } from "@/lib/types/ai-schemas";
import { converseWithSpeculativeTeacher } from "@/ai/flows/create-speculative-teacher-flow";
import { cn } from "@/lib/utils";

const mimeType = 'audio/webm;codecs=opus';
const SPEECH_END_TIMEOUT_MS = 3000;
const MIN_SPEECH_DURATION_MS = 250;

type SessionState = "idle" | "initializing" | "speaking" | "listening" | "processing" | "ending" | "finished";
type TurnWithAnimation = ConversationTurn & { justUpdated?: boolean; id?: number };


export function SpeculativeConversationTool() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [conversation, setConversation] = useState<TurnWithAnimation[]>([]);
  const [sessionBlob, setSessionBlob] = useState<Blob | null>(null);

  const mainRecorderRef = useRef<MediaRecorder | null>(null);
  const turnRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechStartTimeRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const interimTranscriptRef = useRef<string>("");
  const interimTurnIdRef = useRef<number | null>(null);


  const cleanup = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    [mainRecorderRef, turnRecorderRef].forEach(ref => {
        if (ref.current && ref.current.state === 'recording') {
            ref.current.stop();
        }
    });
    if (speechRecognitionRef.current) {
        speechRecognitionRef.current.onresult = null;
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.onerror = null;
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current = null;
    }
    audioChunksRef.current = [];
    speechStartTimeRef.current = null;
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    interimTurnIdRef.current = null;
  }, []);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    setSessionState("processing");

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
            conversationHistory: conversation.filter(turn => turn.role !== 'user_interim'),
        });

        setConversation(prev => {
            const newHistory = prev.filter(turn => turn.id !== interimTurnIdRef.current);
            newHistory.push({ role: 'user', text: finalStudentTranscript || "(음성 인식 안됨)", justUpdated: true, id: interimTurnIdRef.current || Date.now() });
            newHistory.push({ role: 'model', text: aiResponseText });
            return newHistory;
        });

        setSessionState("speaking");

        if (audioPlayerRef.current) {
            audioPlayerRef.current.src = aiResponseAudioDataUri;
            await audioPlayerRef.current.play().catch(() => {
                 toast({ title: "오디오 재생 오류", variant: "destructive" });
                 (window as any)._startListeningVAD?.();
            });
        }
    } catch(err) {
        toast({ title: "AI 처리 오류", description: (err as Error).message, variant: "destructive" });
        setConversation(prev => prev.filter(turn => turn.role !== 'user_interim'));
        setSessionState('speaking');
    }
  }, [conversation, toast]);


  const startListeningVAD = useCallback(() => {
    setSessionState("listening");
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
    if (turnRecorderRef.current?.state === 'recording') turnRecorderRef.current.stop();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        toast({ title: "브라우저 지원 안함", variant: "destructive"});
        setSessionState("idle");
        return;
    }

    try {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            turnRecorderRef.current = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 16000 });
            audioChunksRef.current = [];

            turnRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };
            turnRecorderRef.current.onstop = () => {
                const fullAudioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                const currentSessionState = (window as any)._sessionState;
                if (fullAudioBlob.size > 1000 && currentSessionState === 'listening') {
                    processAudio(fullAudioBlob);
                }
                stream.getTracks().forEach(track => track.stop());
            };
            turnRecorderRef.current.start(200);

            const recognition = new SpeechRecognition();
            speechRecognitionRef.current = recognition;
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            const stopAll = () => {
                if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
                if (turnRecorderRef.current?.state === 'recording') turnRecorderRef.current.stop();
            }

            const resetSilenceTimer = () => {
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                    if (speechStartTimeRef.current && (Date.now() - speechStartTimeRef.current > MIN_SPEECH_DURATION_MS)) {
                       stopAll();
                    }
                }, SPEECH_END_TIMEOUT_MS);
            };

            recognition.onresult = (event) => {
                interimTranscriptRef.current = "";
                let localFinal = finalTranscriptRef.current;
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                     if(event.results[i].isFinal) {
                        localFinal += event.results[i][0].transcript + ' ';
                     } else {
                        interimTranscriptRef.current += event.results[i][0].transcript;
                     }
                }
                finalTranscriptRef.current = localFinal;
                const fullInterimText = (finalTranscriptRef.current + interimTranscriptRef.current).trim();

                if (fullInterimText && !speechStartTimeRef.current) {
                    speechStartTimeRef.current = Date.now();
                    const newInterimTurn = { role: 'user_interim', text: fullInterimText, id: Date.now() };
                    interimTurnIdRef.current = newInterimTurn.id;
                    setConversation(prev => [...prev, newInterimTurn]);
                } else if (interimTurnIdRef.current) {
                    setConversation(prev => prev.map(t => t.id === interimTurnIdRef.current ? {...t, text: fullInterimText} : t));
                }

                if (fullInterimText) {
                    resetSilenceTimer();
                }
            };

            recognition.onend = () => {
                if (turnRecorderRef.current?.state === 'recording') {
                     turnRecorderRef.current.stop();
                }
                 speechStartTimeRef.current = null;
            }

            recognition.onerror = (event) => {
                if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    toast({title: "음성 인식 오류", variant: "destructive"});
                    setSessionState("idle");
                }
            };

            recognition.start();

        }).catch(err => {
            toast({ title: "마이크 오류", variant: "destructive" });
            setSessionState("idle");
        });
    } catch (err) {
        toast({ title: "음성 인식 시작 오류", variant: "destructive" });
        setSessionState("idle");
    }
  }, [processAudio, toast]);

  useEffect(() => {
      (window as any)._startListeningVAD = startListeningVAD;
      (window as any)._sessionState = sessionState;
      return () => { delete (window as any)._startListeningVAD; delete (window as any)._sessionState; }
  }, [startListeningVAD, sessionState]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [conversation]);

  const startConversation = async () => {
    setConversation([]);
    setSessionState("initializing");
    setSessionBlob(null);

    try {
      const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      const micSource = audioContext.createMediaStreamSource(userStream);
      micSource.connect(destination);

      if (audioPlayerRef.current) {
        const audioSource = audioContext.createMediaElementSource(audioPlayerRef.current);
        audioSource.connect(destination);
        audioSource.connect(audioContext.destination);
      }
      
      mainRecorderRef.current = new MediaRecorder(destination.stream, { mimeType });
      const mainChunks: Blob[] = [];
      
      mainRecorderRef.current.ondataavailable = e => mainChunks.push(e.data);
      
      mainRecorderRef.current.onstop = () => {
          setSessionBlob(new Blob(mainChunks, { type: mimeType }));
          userStream.getTracks().forEach(t => t.stop());
          destination.stream.getTracks().forEach(t => t.stop());
          audioContext.close().catch(e => console.warn("Audio context close failed", e));
      };

      mainRecorderRef.current.start();
      toast({ title: "전체 대화 녹음 시작됨" });


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
    setSessionBlob(null);
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
        case 'finished': 
            return (
                <div className="flex gap-2">
                    {sessionBlob && (
                        <a href={URL.createObjectURL(sessionBlob)} download={`conversation-${new Date().toISOString()}.webm`}>
                            <Button size="lg" className="w-full">
                                <Download className="mr-2 h-5 w-5" />
                                전체 대화 녹음 다운로드
                            </Button>
                        </a>
                    )}
                    <Button size="lg" onClick={handleReset} variant="outline" className="w-full"><RefreshCw className="mr-2"/>새로 시작</Button>
                </div>
            );
        default: return <Button size="lg" onClick={handleStopConversation} variant="destructive" className="w-full" disabled={sessionState==='ending' || sessionState==='initializing' || sessionState==='processing'}><StopCircle className="mr-2"/>대화 종료</Button>
    }
  }

   const getStatusIndicator = () => {
      switch(sessionState) {
        case 'speaking': return <div className="flex items-center gap-2 text-sm font-medium"><Volume2 className="h-5 w-5 text-green-500 animate-pulse"/><span>AI 응답 중...</span></div>
        case 'listening': return <div className="flex items-center gap-2 text-sm font-medium"><Mic className="h-5 w-5 text-blue-500 animate-pulse"/><span>듣는 중...</span></div>
        case 'processing': return <div className="flex items-center gap-2 text-sm font-medium"><Loader2 className="h-5 w-5 animate-spin"/><span>처리 중...</span></div>
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
                  <p className="font-semibold">'대화 시작'을 누르면 AI와 사용자의 모든 음성이 녹음됩니다.</p>
                  <p className="text-sm">침묵이 감지되면 자동으로 턴이 넘어갑니다.</p>
              </div>
            )}
            {sessionState === "finished" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-8">
                  <CheckCircle2 className="h-12 w-12 mb-4 text-green-500"/>
                  <p className="font-semibold">대화가 종료 및 녹음 완료되었습니다.</p>
                  <p className="text-sm">아래에서 전체 대화 녹음 파일을 재생하거나 다운로드하세요.</p>
                   {sessionBlob && <audio src={URL.createObjectURL(sessionBlob)} controls className="mt-4 w-full max-w-sm"></audio>}
              </div>
            )}
            {sessionState === "initializing" && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                     <Loader2 className="h-12 w-12 mb-4 animate-spin"/>
                     <p className="font-semibold">AI가 첫 인사를 준비 중입니다...</p>
                 </div>
            )}
            {conversation.map((turn, index) => {
                 const isUser = turn.role === 'user' || turn.role === 'user_interim';
                 const isInterim = turn.role === 'user_interim';

                 return (
                    <div key={turn.id || index} className={cn("flex items-start gap-3", isUser ? 'justify-start' : 'justify-end')}>
                        {isUser && <div className="p-2 rounded-full bg-muted"><User className="h-5 w-5" /></div>}
                        <div className={cn(
                            "p-3 rounded-lg max-w-[80%]",
                            isUser ? 'bg-muted' : 'bg-primary text-primary-foreground',
                            turn.justUpdated && 'animate-glow-once'
                        )}>
                        <p className={cn(
                            "text-sm",
                            isInterim && "text-muted-foreground italic",
                            turn.justUpdated && "text-blue-600 font-medium"
                        )}>{turn.text}</p>
                        </div>
                        {turn.role === 'model' && <div className="p-2 rounded-full bg-primary text-primary-foreground"><Bot className="h-5 w-5" /></div>}
                    </div>
                )
             })}
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

      <audio ref={audioPlayerRef} onEnded={handleAudioEnded} crossOrigin="anonymous" className="hidden" />
    </div>
  );
}
