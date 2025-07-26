
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
const INITIAL_CHUNK_DURATION = 2000; // 2 seconds

type SessionState = "idle" | "initializing" | "speaking" | "recording" | "processing" | "finished";

export function SpeculativeConversationTool() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  
  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (mediaRecorderRef.current.stream) {
             mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
    setInterimTranscript("");
  }, []);

  useEffect(() => {
    if (scrollViewportRef.current) {
        const viewport = scrollViewportRef.current.querySelector('div');
        if (viewport) {
           viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [conversation, interimTranscript]);

  const processFullAudio = useCallback(async (fullAudioBlob: Blob) => {
    setSessionState("processing");
    setInterimTranscript("처리 중...");
    
    // Create the initial chunk from the recorded data.
    // The recorder saves data every 100ms, so 20 chunks = 2 seconds.
    const initialChunkBlob = new Blob(audioChunksRef.current.slice(0, 20), { type: mimeType });
    
    // If the initial chunk is empty, something went wrong, but we can still proceed with the full audio.
    if(initialChunkBlob.size === 0) {
        toast({ title: "경고", description: "초기 음성 데이터가 작아 예측 없이 처리합니다.", variant: "default" });
    }

    const [initialChunkDataUri, finalAudioDataUri] = await Promise.all([
        new Promise<string>(resolve => {
            if (initialChunkBlob.size === 0) {
                resolve(""); // Resolve with empty string if no initial chunk
                return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(initialChunkBlob);
            reader.onloadend = () => resolve(reader.result as string);
        }),
        new Promise<string>(resolve => {
            const reader = new FileReader();
            reader.readAsDataURL(fullAudioBlob);
            reader.onloadend = () => resolve(reader.result as string);
        }),
    ]);
    
    try {
        const { finalStudentTranscript, aiResponseText, aiResponseAudioDataUri } = await converseWithSpeculativeTeacher({
            initialChunkDataUri: initialChunkDataUri || undefined, // Send undefined if empty
            finalAudioDataUri: finalAudioDataUri,
            conversationHistory: conversation,
        });

        const newHistory: ConversationTurn[] = [
            ...conversation,
            { role: 'user', text: finalStudentTranscript },
            { role: 'model', text: aiResponseText },
        ];
        setConversation(newHistory);
        setInterimTranscript(""); // Clear interim transcript after processing
        setSessionState("speaking");

        if (audioPlayerRef.current) {
            audioPlayerRef.current.src = aiResponseAudioDataUri;
            await audioPlayerRef.current.play().catch(() => {
                 toast({ title: "오디오 재생 오류", variant: "destructive" });
                 setSessionState('recording');
            });
        }
    } catch(err) {
        toast({ title: "AI 처리 오류", description: (err as Error).message, variant: "destructive" });
        setSessionState('speaking'); // Let user try again by speaking
    }

  }, [conversation, toast]);
  

  const handleStartRecording = useCallback(async () => {
    if (sessionState !== 'speaking' && sessionState !== 'initializing') return;
    setSessionState("recording");
    cleanup();
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 16000 });
        
        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        mediaRecorderRef.current.onstop = () => {
            const fullAudioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            if (fullAudioBlob.size > 0) {
                processFullAudio(fullAudioBlob);
            } else {
                setSessionState('speaking');
            }
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start(100); // Collect audio in chunks (important for slicing)
        
    } catch (err) {
         toast({ title: "마이크 오류", variant: "destructive" });
         setSessionState('idle');
    }

  }, [cleanup, processFullAudio, sessionState, toast]);

  const handleStopRecording = () => {
      if(mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
      }
  };

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
            handleStartRecording();
        });
      }
    } catch (error) {
      toast({ title: "대화 시작 오류", variant: "destructive" });
      setSessionState("idle");
    }
  };
  
  const handleReset = () => {
    setSessionState("idle");
    setConversation([]);
    cleanup();
  }

  const handleAudioEnded = () => {
      if (sessionState === 'speaking') {
          handleStartRecording();
      }
  };
  
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);


  const getButtonState = () => {
      switch(sessionState) {
          case 'idle': return <Button size="lg" onClick={startConversation} className="w-full"><Play className="mr-2"/>대화 시작</Button>;
          case 'finished': return <Button size="lg" onClick={handleReset} variant="outline" className="w-full"><RefreshCw className="mr-2"/>새로 시작</Button>;
          case 'initializing':
          case 'processing': return <Button size="lg" disabled className="w-full"><Loader2 className="mr-2 animate-spin"/> {sessionState === 'initializing' ? '준비 중...' : '처리 중...'}</Button>
          case 'speaking': return <Button size="lg" onClick={handleStartRecording} className="w-full"><Mic className="mr-2"/> 말하기 시작</Button>;
          case 'recording': return <Button size="lg" onClick={handleStopRecording} variant="destructive" className="w-full"><StopCircle className="mr-2"/>말하기 중지</Button>
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
                  <p className="text-sm">AI의 말이 끝나면 '말하기 시작' 버튼을 누르세요.</p>
              </div>
            )}
             {sessionState === "finished" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-8">
                  <CheckCircle2 className="h-12 w-12 mb-4 text-green-500"/>
                  <p className="font-semibold">대화가 종료되었습니다.</p>
              </div>
            )}
            {["initializing", "processing"].includes(sessionState) && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                     <Loader2 className="h-12 w-12 mb-4 animate-spin"/>
                     <p className="font-semibold">{sessionState === 'initializing' ? 'AI가 첫 인사를 준비 중입니다...' : '답변을 처리하고 있습니다...'}</p>
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
      <div className="flex flex-col gap-2">
        {getButtonState()}
        <p className="text-xs text-center text-muted-foreground">
            {sessionState === 'recording' ? "말씀을 하세요... 완료되면 '말하기 중지'를 누르세요." : 
             sessionState === 'speaking' ? "AI의 응답이 끝나면 '말하기 시작'을 누르세요." : 
             sessionState !== 'idle' && sessionState !== 'finished' ? "잠시만 기다려주세요..." : ""}
        </p>
      </div>

      <audio ref={audioPlayerRef} onEnded={handleAudioEnded} className="hidden" />
    </div>
  );
}
