
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

const mimeType = 'audio/webm;codecs=opus';
const SILENCE_DURATION_MS = 6000; // 6 seconds of silence to trigger turn end

type SessionState = "idle" | "initializing" | "speaking" | "listening" | "processing" | "ending";

export function VadConversationTool() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string | null>(null);
  const [silenceThreshold, setSilenceThreshold] = useState(0.03);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  
  const { toast } = useToast();

  const cleanup = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
    }
    if (mediaRecorderRef.current) {
        if(mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.onerror = null;
    }
    if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
    }
    mediaRecorderRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    audioStreamRef.current = null;
    audioChunksRef.current = [];
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

  const startListening = useCallback(async () => {
    if (sessionState === 'ending') return;
    setSessionState("listening");
    setInterimTranscript("듣고 있어요...");

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;

        // Setup VAD
        const context = new AudioContext();
        audioContextRef.current = context;
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Setup MediaRecorder
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        mediaRecorderRef.current.onstop = () => {
             if (audioChunksRef.current.length === 0) {
                 console.warn("No audio recorded.");
                 startListening(); // Just listen again if nothing was said.
                 return;
             }
             const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
             const reader = new FileReader();
             reader.readAsDataURL(audioBlob);
             reader.onloadend = async () => processAudio(reader.result as string);
        };
        
        const checkForSilence = () => {
            if (sessionState === 'ending' || !analyserRef.current) return;
            
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            
            // A more robust way to check for speaking activity
            const sum = dataArray.reduce((acc, val) => acc + val, 0);
            const avg = sum / dataArray.length;
            const isSpeaking = avg > (silenceThreshold * 10); // scale threshold for this calculation

            if (isSpeaking) {
                if (mediaRecorderRef.current?.state === 'inactive') {
                    mediaRecorderRef.current.start();
                }
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = null;
                }
            } else { // Silence detected
                if (mediaRecorderRef.current?.state === 'recording' && !silenceTimerRef.current) {
                    silenceTimerRef.current = setTimeout(() => {
                        if (mediaRecorderRef.current?.state === 'recording') {
                            mediaRecorderRef.current.stop();
                        }
                    }, SILENCE_DURATION_MS);
                }
            }
            requestAnimationFrame(checkForSilence);
        };

        requestAnimationFrame(checkForSilence);

    } catch (err) {
        console.error("Mic access error:", err);
        toast({ title: "마이크 오류", description: "마이크 접근 권한을 허용해주세요.", variant: "destructive" });
        setSessionState("idle");
    }
  }, [sessionState, toast, silenceThreshold]);

  const startConversation = async () => {
    setConversation([]);
    setInterimTranscript(null);
    setSessionState("initializing");
    try {
      const { aiResponseText, aiResponseAudioDataUri } = await converseWithNativeTeacher({
        studentRecordingDataUri: null,
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
  
  const processAudio = async (dataUri: string) => {
    setSessionState("processing");
    setInterimTranscript("처리 중...");
    cleanup(); // Clean up mic/VAD resources while processing

    try {
        const { studentTranscript, aiResponseText, aiResponseAudioDataUri } = await converseWithNativeTeacher({
            studentRecordingDataUri: dataUri,
            conversationHistory: conversation,
        });

        setInterimTranscript(null);
        setConversation(prev => [...prev, {role: 'user', text: studentTranscript}, {role: 'model', text: aiResponseText}]);
        
        if (audioPlayerRef.current) {
            audioPlayerRef.current.src = aiResponseAudioDataUri;
            audioPlayerRef.current.play();
            setSessionState("speaking");
        }
    } catch (error) {
        toast({ title: "AI 처리 오류", variant: "destructive" });
        setSessionState("listening"); // Go back to listening if AI fails
    }
  };

  const handleStopConversation = () => {
    setSessionState("ending");
    cleanup();
    setSessionState("idle");
    setInterimTranscript(null);
    toast({ title: "대화 종료됨" });
  }

  const getButtonState = () => {
      if (sessionState === 'idle') {
          return <Button size="lg" onClick={startConversation} className="w-full"><Play className="mr-2"/>대화 시작</Button>
      }
      return <Button size="lg" onClick={handleStopConversation} variant="destructive" className="w-full"><StopCircle className="mr-2"/>대화 종료</Button>
  }

  return (
    <div className="flex flex-col gap-4">
      <ScrollArea className="h-80 w-full rounded-md border p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
            {sessionState === "idle" && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                  <BrainCircuit className="h-12 w-12 mb-4 text-primary"/>
                  <p className="font-semibold">'대화 시작'을 누르면 자동으로 대화가 진행됩니다.</p>
                  <p className="text-sm">약 6초간 말이 없으면 자동으로 AI에게 턴이 넘어갑니다.</p>
              </div>
            )}
            {["initializing", "processing"].includes(sessionState) && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-12">
                     <Loader2 className="h-12 w-12 mb-4 animate-spin"/>
                     <p className="font-semibold">
                         {sessionState === 'initializing' ? 'AI가 첫 인사를 준비 중입니다...' : 'AI가 답변을 생각 중입니다...'}
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
        <div className="grid gap-2">
            <Label htmlFor="sensitivity" className="text-xs text-muted-foreground">
                마이크 민감도 (왼쪽: 더 민감, 오른쪽: 덜 민감)
            </Label>
            <Slider
                id="sensitivity"
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
                {sessionState === 'speaking' && "AI가 응답 중입니다..."}
                {sessionState === 'listening' && "네, 듣고 있어요. 편하게 말씀하세요..."}
            </p>
        )}
      </div>

      <audio ref={audioPlayerRef} onEnded={startListening} className="hidden" />
    </div>
  );
}

