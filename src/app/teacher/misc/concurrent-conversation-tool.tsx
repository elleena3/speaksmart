
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2, Bot, User, Play, Volume2, BrainCircuit, Download, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type ConversationTurn } from "@/lib/types/ai-schemas";
import { converseWithNativeTeacher } from "@/ai/flows/create-concurrent-teacher-flow"

const mimeType = 'audio/webm;codecs=opus';

export function ConcurrentConversationTool() {
  const [sessionState, setSessionState] = useState<"idle" | "initializing" | "recording" | "processing" | "speaking" | "waiting_for_user" | "finished">("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const { toast } = useToast();

  const cleanupRecorder = useCallback(() => {
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
  }, []);

  const cleanupAudioPlayer = useCallback(() => {
    if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.removeAttribute('src');
        audioPlayerRef.current.load();
    }
  }, []);

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      cleanupRecorder();
      cleanupAudioPlayer();
    };
  }, [cleanupRecorder, cleanupAudioPlayer]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollableView = scrollAreaRef.current.querySelector('div');
      if (scrollableView) {
        scrollableView.scrollTop = scrollableView.scrollHeight;
      }
    }
  }, [conversation, interimTranscript]);

  const handleReset = () => {
    cleanupRecorder();
    cleanupAudioPlayer();
    setConversation([]);
    setInterimTranscript(null);
    setRecordedBlob(null);
    setSessionState('idle');
  }

  const startConversationAndRecording = async () => {
    handleReset();
    setSessionState("recording");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // User mic input
      const micSource = audioContext.createMediaStreamSource(stream);
      micSource.connect(destination);
      
      // AI audio output
      if (audioPlayerRef.current) {
        const audioSource = audioContext.createMediaElementSource(audioPlayerRef.current);
        audioSource.connect(destination);
        audioSource.connect(audioContext.destination); // Play AI audio through speakers
      }

      mediaRecorderRef.current = new MediaRecorder(destination.stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setSessionState("finished");
        stream.getTracks().forEach(track => track.stop());
        audioContext.close().catch(e => console.warn("AudioContext could not be closed:", e));
      };
      
      mediaRecorderRef.current.start();
      toast({ title: "전체 대화 녹음 시작됨", description: "AI 음성과 사용자 음성이 모두 녹음됩니다." });

      // Get AI's first turn
      processTurn(null);

    } catch (err) {
      console.error("Error setting up recording:", err);
      toast({ title: "녹음 오류", description: "마이크 접근 또는 오디오 설정에 문제가 있습니다.", variant: "destructive" });
      setSessionState('idle');
    }
  };

  const processTurn = async (userAudioUri: string | null) => {
    setSessionState(userAudioUri ? 'processing' : 'initializing');
    if (userAudioUri) setInterimTranscript("처리 중...");

    try {
        const { studentTranscript, aiResponseText, aiResponseAudioDataUri } = await converseWithNativeTeacher({
            studentRecordingDataUri: userAudioUri,
            conversationHistory: conversation,
        });

        if(userAudioUri) {
            setConversation(prev => [...prev, { role: 'user', text: studentTranscript }]);
        }
        setConversation(prev => [...prev, { role: 'model', text: aiResponseText }]);
        setInterimTranscript(null);

        if (audioPlayerRef.current) {
            audioPlayerRef.current.src = aiResponseAudioDataUri;
            audioPlayerRef.current.play();
            setSessionState("speaking");
        }
    } catch (error) {
        console.error("Error processing turn:", error);
        toast({ title: "처리 오류", description: "AI 응답을 가져오는 중 오류가 발생했습니다.", variant: "destructive" });
        setSessionState("waiting_for_user");
    }
  }

  const handleStopConversation = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
    // Other states might need cleanup too
    if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setSessionState("finished");
  };

  const handleUserResponse = async () => {
    setInterimTranscript("듣고 있어요...");
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const tempRecorder = new MediaRecorder(stream, { mimeType });
        const tempChunks: Blob[] = [];

        tempRecorder.ondataavailable = e => tempChunks.push(e.data);
        tempRecorder.onstop = () => {
            const blob = new Blob(tempChunks, { type: mimeType });
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => processTurn(reader.result as string);
            stream.getTracks().forEach(track => track.stop());
        };
        
        setTimeout(() => {
            if (tempRecorder.state === 'recording') {
                tempRecorder.stop();
            }
        }, 5000); // 5-second response limit for user
        tempRecorder.start();
        
    } catch (err) {
        toast({ title: "마이크 오류", description: "마이크에 접근할 수 없습니다.", variant: "destructive" });
        setInterimTranscript(null);
    }
  };


  const getButtonState = () => {
    switch (sessionState) {
      case "idle":
        return (
          <Button size="lg" onClick={startConversationAndRecording} className="w-full">
            <Play className="mr-2 h-5 w-5" />
            대화 및 녹음 시작
          </Button>
        );
      case "recording":
      case "speaking":
      case "processing":
      case "initializing":
        return (
          <Button size="lg" onClick={handleStopConversation} className="w-full" variant="destructive">
            <StopCircle className="mr-2 h-5 w-5" />
            대화 및 녹음 중지
          </Button>
        );
      case "finished":
        return (
            <div className="flex gap-2">
                {recordedBlob && (
                    <a href={URL.createObjectURL(recordedBlob)} download={`conversation-${new Date().toISOString()}.webm`}>
                        <Button size="lg" className="w-full">
                            <Download className="mr-2 h-5 w-5" />
                            녹음 파일 다운로드
                        </Button>
                    </a>
                )}
                <Button size="lg" onClick={handleReset} variant="outline" className="w-full">
                    <RefreshCw className="mr-2 h-5 w-5" />
                    새로 시작
                </Button>
            </div>
        );
      case "waiting_for_user":
          return (
              <Button size="lg" disabled className="w-full">
                  <Mic className="mr-2 h-5 w-5 animate-pulse" />
                  AI가 응답을 기다립니다... (대화 종료됨)
              </Button>
          );
    }
  };


  return (
    <div className="flex flex-col gap-4">
      <ScrollArea className="h-80 w-full rounded-md border p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
            {sessionState === "idle" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                  <BrainCircuit className="h-12 w-12 mb-4 text-primary"/>
                  <p className="font-semibold">'대화 및 녹음 시작'을 누르면 AI와 사용자의 모든 음성이 녹음됩니다.</p>
                  <p className="text-sm">대화를 마치려면 '녹음 중지'를 누르세요.</p>
              </div>
            )}
            {sessionState === "finished" && recordedBlob && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                  <Download className="h-12 w-12 mb-4 text-primary"/>
                  <p className="font-semibold">대화 녹음이 완료되었습니다.</p>
                  <p className="text-sm">아래 버튼을 눌러 녹음된 대화 파일을 다운로드하세요.</p>
                  <audio src={URL.createObjectURL(recordedBlob)} controls className="mt-4 w-full max-w-sm"></audio>
              </div>
            )}
            {["initializing", "recording", "speaking", "processing"].includes(sessionState) && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                     <Loader2 className="h-12 w-12 mb-4 animate-spin"/>
                     <p className="font-semibold">
                         {sessionState === 'recording' ? "대화가 녹음 중입니다..." : "AI가 응답을 준비 중입니다..."}
                     </p>
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
        </div>
      </ScrollArea>
      
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
            <div className="flex-grow">
              {getButtonState()}
            </div>
        </div>
      </div>

      <audio ref={audioPlayerRef} onEnded={() => {
          if (mediaRecorderRef.current?.state === 'recording') {
            handleUserResponse();
          } else {
            setSessionState('finished');
          }
      }} crossOrigin="anonymous" className="hidden" />
    </div>
  );
}
