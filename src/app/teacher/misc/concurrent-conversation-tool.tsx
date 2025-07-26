
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle, Loader2, Bot, User, Play, Volume2, BrainCircuit, Download, RefreshCw, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type ConversationTurn } from "@/lib/types/ai-schemas";
import { converseWithConcurrentTeacher, transcribeUserAudio } from "@/ai/flows/create-concurrent-teacher-flow"

const mimeType = 'audio/webm;codecs=opus';

type SessionState = "idle" | "initializing" | "user_replying" | "processing" | "speaking" | "finishing" | "finished";

export function ConcurrentConversationTool() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const mainRecorderRef = useRef<MediaRecorder | null>(null);
  const userReplyRecorderRef = useRef<MediaRecorder | null>(null);
  
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const { toast } = useToast();

  const cleanupRecorders = useCallback(() => {
    [mainRecorderRef, userReplyRecorderRef].forEach(ref => {
      if (ref.current) {
        if (ref.current.stream) {
          ref.current.stream.getTracks().forEach(track => track.stop());
        }
        ref.current.ondataavailable = null;
        ref.current.onstop = null;
        ref.current.onerror = null;
        ref.current = null;
      }
    });
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
      cleanupRecorders();
      cleanupAudioPlayer();
    };
  }, [cleanupRecorders, cleanupAudioPlayer]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollableView = scrollAreaRef.current.querySelector('div');
      if (scrollableView) {
        scrollableView.scrollTop = scrollableView.scrollHeight;
      }
    }
  }, [conversation, interimTranscript]);

  const handleReset = () => {
    cleanupRecorders();
    cleanupAudioPlayer();
    setConversation([]);
    setInterimTranscript(null);
    setRecordedBlob(null);
    setSessionState('idle');
  }

  const startConversation = async () => {
    handleReset();
    setSessionState("initializing");
    
    try {
      const mainStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      
      const micSource = audioContext.createMediaStreamSource(mainStream);
      micSource.connect(destination);
      
      if (audioPlayerRef.current) {
        const audioSource = audioContext.createMediaElementSource(audioPlayerRef.current);
        audioSource.connect(destination);
        audioSource.connect(audioContext.destination);
      }
      
      mainRecorderRef.current = new MediaRecorder(destination.stream, { mimeType });
      const mainChunks: Blob[] = [];
      mainRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) mainChunks.push(event.data);
      };
      
      mainRecorderRef.current.onstop = () => {
        const blob = new Blob(mainChunks, { type: mimeType });
        setRecordedBlob(blob);
        mainStream.getTracks().forEach(track => track.stop());
        destination.stream.getTracks().forEach(track => track.stop());
        audioContext.close().catch(e => console.warn("AudioContext could not be closed:", e));
        setSessionState("finished");
      };
      
      mainRecorderRef.current.start();
      toast({ title: "전체 대화 녹음 시작됨", description: "AI 음성과 사용자 음성이 모두 녹음됩니다." });

      // Get AI's first turn
      const { aiResponseText, aiResponseAudioDataUri } = await converseWithConcurrentTeacher({
          studentTranscript: null,
          conversationHistory: [],
      });
      setConversation([{ role: 'model', text: aiResponseText }]);

      if (audioPlayerRef.current) {
          audioPlayerRef.current.src = aiResponseAudioDataUri;
          audioPlayerRef.current.play();
          setSessionState("speaking");
      }
    } catch (err) {
      console.error("Error setting up recording:", err);
      toast({ title: "녹음 오류", description: "마이크 접근 또는 오디오 설정에 문제가 있습니다.", variant: "destructive" });
      setSessionState('idle');
    }
  };

  const handleUserResponse = async () => {
    if (sessionState !== 'speaking' && sessionState !== 'initializing') return;
    setSessionState("user_replying");
    setInterimTranscript("듣고 있어요...");

    try {
      const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      userReplyRecorderRef.current = new MediaRecorder(userStream, { mimeType });
      const userChunks: Blob[] = [];
      
      userReplyRecorderRef.current.ondataavailable = e => userChunks.push(e.data);
      
      userReplyRecorderRef.current.onstop = () => {
        userStream.getTracks().forEach(track => track.stop());
        if (userChunks.length === 0) {
            processTurn(""); // Send empty string if no audio
            return;
        }
        const blob = new Blob(userChunks, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => processTurn(reader.result as string);
      };
      
      userReplyRecorderRef.current.start();
    } catch(err) {
      toast({ title: "마이크 오류", description: "마이크에 접근할 수 없습니다.", variant: "destructive" });
      setInterimTranscript(null);
      setSessionState('speaking');
    }
  }

  const handleStopUserResponse = () => {
      if (userReplyRecorderRef.current?.state === 'recording') {
          userReplyRecorderRef.current.stop();
          setSessionState('processing');
      }
  }

  const processTurn = async (userAudioUri: string) => {
    setSessionState('processing');
    setInterimTranscript("처리 중...");

    try {
        const studentTranscript = userAudioUri ? await transcribeUserAudio(userAudioUri) : "(The user did not say anything)";
        setInterimTranscript(null);
        setConversation(prev => [...prev, { role: 'user', text: studentTranscript }]);

        const { aiResponseText, aiResponseAudioDataUri } = await converseWithConcurrentTeacher({
            studentTranscript: studentTranscript,
            conversationHistory: conversation,
        });

        setConversation(prev => [...prev, { role: 'model', text: aiResponseText }]);

        if (audioPlayerRef.current) {
            audioPlayerRef.current.src = aiResponseAudioDataUri;
            audioPlayerRef.current.play();
            setSessionState("speaking");
        }
    } catch (error) {
        console.error("Error processing turn:", error);
        toast({ title: "처리 오류", description: "AI 응답을 가져오는 중 오류가 발생했습니다.", variant: "destructive" });
        setSessionState("speaking"); // Let them try again
    }
  }

  const handleStopConversation = () => {
    if (mainRecorderRef.current?.state === 'recording') {
        setSessionState("finishing");
        mainRecorderRef.current.stop(); // This will trigger onstop event after a delay
    } else {
        cleanupRecorders();
        cleanupAudioPlayer();
    }
  };


  const getButtonState = () => {
    switch (sessionState) {
      case "idle":
        return (
          <Button size="lg" onClick={startConversation} className="w-full">
            <Play className="mr-2 h-5 w-5" />
            대화 및 녹음 시작
          </Button>
        );
      case "initializing":
      case "processing":
      case "finishing":
          return (
             <Button size="lg" disabled className="w-full">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {sessionState === "initializing" ? "AI 준비 중..." : sessionState === 'processing' ? "AI 생각 중..." : "녹음 파일 생성 중..."}
            </Button>
          )
      case "speaking":
        return (
            <Button size="lg" onClick={handleUserResponse} className="w-full">
                <Mic className="mr-2 h-5 w-5" />
                응답하기
            </Button>
        );
      case "user_replying":
          return (
            <Button size="lg" onClick={handleStopUserResponse} className="w-full" variant="destructive">
                <StopCircle className="mr-2 h-5 w-5" />
                말하기 중지
            </Button>
          )
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
                  <p className="text-sm">대화를 마치려면 '대화 종료'를 누르세요.</p>
              </div>
            )}
            {sessionState === "finished" && recordedBlob && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-8">
                  <CheckCircle2 className="h-12 w-12 mb-4 text-green-500"/>
                  <p className="font-semibold">대화 녹음이 완료되었습니다.</p>
                  <p className="text-sm">아래 버튼을 눌러 녹음된 대화 파일을 다운로드하세요.</p>
                  <audio src={URL.createObjectURL(recordedBlob)} controls className="mt-4 w-full max-w-sm"></audio>
              </div>
            )}
            {["initializing", "finishing"].includes(sessionState) && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                     <Loader2 className="h-12 w-12 mb-4 animate-spin"/>
                     <p className="font-semibold">
                         {sessionState === 'initializing' ? 'AI가 응답을 준비 중입니다...' : '대화 녹음 파일을 생성 중입니다...'}
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
             {interimTranscript && (
                <div className="flex items-start gap-3 justify-start">
                    <div className="p-2 rounded-full bg-muted">
                        <User className="h-5 w-5" />
                    </div>
                    <div className="p-3 rounded-lg max-w-[80%] bg-muted">
                        <p className="text-sm text-muted-foreground italic">{interimTranscript}</p>
                    </div>
                </div>
            )}
        </div>
      </ScrollArea>
      
      <div className="flex flex-col gap-2">
        <div className="flex justify-between gap-2">
            <div className="flex-grow">
              {getButtonState()}
            </div>
            {sessionState !== "idle" && sessionState !== 'finished' && sessionState !== 'finishing' && (
              <Button onClick={handleStopConversation} variant="destructive">
                대화 종료
              </Button>
            )}
        </div>
      </div>

      <audio ref={audioPlayerRef} onEnded={handleUserResponse} crossOrigin="anonymous" className="hidden" />
    </div>
  );
}
