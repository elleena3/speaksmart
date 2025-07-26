
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, Bot, User, Play, Volume2, BrainCircuit, Loader2, StopCircle, RefreshCw, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type ConversationTurn } from "@/lib/types/ai-schemas";
import { converseWithParallelTeacher } from "@/ai/flows/create-parallel-teacher-flow"
import { cn } from "@/lib/utils"

const mimeType = 'audio/webm;codecs=opus';
const SILENCE_TIMEOUT_MS = 2500; // 2.5초

type SessionState = "idle" | "initializing" | "listening" | "processing" | "speaking" | "finished";

export function ParallelConversationTool() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  
  const { toast } = useToast();

  const cleanupRecorder = useCallback(() => {
    if (mediaRecorderRef.current) {
        if(mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        mediaRecorderRef.current = null;
    }
    if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
    }
    audioChunksRef.current = [];
  }, []);

  useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [conversation]);
  
  const startListening = useCallback(() => {
    setSessionState("listening");

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                if(audioChunksRef.current.length > 0) {
                    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                    processAudio(audioBlob);
                }
            };
            
            mediaRecorderRef.current.start(100); // Collect audio in chunks

            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
            }, SILENCE_TIMEOUT_MS);
        } catch (err) {
            toast({ title: "마이크 오류", description: "마이크에 접근할 수 없습니다.", variant: "destructive" });
            setSessionState('idle');
        }
    }
    startRecording();
  }, [toast]);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    setSessionState("processing");
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
        const audioDataUri = reader.result as string;
        try {
            const { studentTranscript, aiResponseText, aiResponseAudioDataUri } = await converseWithParallelTeacher({
                studentRecordingDataUri: audioDataUri,
                conversationHistory: conversation,
            });
            
            const newHistory: ConversationTurn[] = [
                ...conversation,
                { role: 'user', text: studentTranscript },
                { role: 'model', text: aiResponseText },
            ];
            setConversation(newHistory);
            setSessionState("speaking");

            if (audioPlayerRef.current) {
                audioPlayerRef.current.src = aiResponseAudioDataUri;
                await audioPlayerRef.current.play().catch(e => {
                    toast({ title: "오디오 재생 오류", variant: "destructive" });
                    startListening();
                });
            } else {
                startListening();
            }

        } catch (error) {
            toast({ title: "AI 처리 오류", variant: "destructive" });
            startListening();
        }
    };
  }, [conversation, toast, startListening]);
  
  const startConversation = async () => {
    setConversation([]);
    setSessionState("initializing");
    try {
      const { aiResponseText, aiResponseAudioDataUri } = await converseWithParallelTeacher({
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
    cleanupRecorder();
    setSessionState("finished");
    toast({ title: "대화 종료됨" });
  }

  const handleReset = () => {
    cleanupRecorder();
    setSessionState("idle");
    setConversation([]);
  }

  const handleAudioEnded = () => {
      if (sessionState === 'speaking') {
          startListening();
      }
  };

  useEffect(() => {
      return () => cleanupRecorder();
  }, [cleanupRecorder]);

  return (
    <div className="flex flex-col gap-4">
      <ScrollArea className="h-80 w-full rounded-md border">
        <div className="p-4 space-y-4" ref={scrollViewportRef}>
            {sessionState === "idle" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                  <BrainCircuit className="h-12 w-12 mb-4 text-primary"/>
                  <p className="font-semibold">'대화 시작'을 누르면 자동으로 대화가 진행됩니다.</p>
                  <p className="text-sm">침묵이 감지되면 자동으로 AI에게 턴이 넘어갑니다.</p>
              </div>
            )}
            {["initializing", "processing"].includes(sessionState) && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                     <Loader2 className="h-12 w-12 mb-4 animate-spin"/>
                     <p className="font-semibold">{sessionState === 'initializing' ? 'AI가 첫 인사를 준비 중입니다...' : '답변을 처리하고 있습니다...'}</p>
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
        </div>
      </ScrollArea>
      
      <div className="flex items-center justify-center gap-4 h-10">
        {sessionState === 'idle' && <Button size="lg" onClick={startConversation} className="w-full"><Play className="mr-2"/>대화 시작</Button>}
        {sessionState === 'finished' && <Button size="lg" onClick={handleReset} variant="outline" className="w-full"><RefreshCw className="mr-2"/>새로 시작</Button>}
        {['listening', 'speaking', 'processing', 'initializing'].includes(sessionState) && (
            <>
                <div className="flex items-center gap-2 text-sm font-medium">
                    {sessionState === 'listening' && <><Mic className="h-5 w-5 text-blue-500 animate-pulse"/><span>듣는 중...</span></>}
                    {sessionState === 'speaking' && <><Volume2 className="h-5 w-5 text-green-500 animate-pulse"/><span>AI 응답 중...</span></>}
                    {(sessionState === 'processing' || sessionState === 'initializing') && <><Loader2 className="h-5 w-5 animate-spin"/><span>처리 중...</span></>}
                </div>
                <Button size="lg" onClick={handleStopConversation} variant="destructive" className="w-full"><StopCircle className="mr-2"/>대화 종료</Button>
            </>
        )}
      </div>

      <audio ref={audioPlayerRef} onEnded={handleAudioEnded} className="hidden" />
    </div>
  );
}
