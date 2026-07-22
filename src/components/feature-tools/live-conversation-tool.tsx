"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mic, Square, Loader2, Play, CheckCircle2, User, Bot, AlertTriangle, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getLiveSessionToken } from "@/ai/flows/get-live-session-token";
import { generateTtsByModelFlow } from "@/ai/flows/generate-tts-by-model-flow";
import { analyzeLiveConversation, type AnalyzeLiveConversationOutput } from "@/ai/flows/analyze-live-conversation-flow";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Progress } from "@/components/ui/progress";

type AppState = 'idle' | 'connecting' | 'connected' | 'analyzing' | 'finished' | 'error';
type Turn = { role: 'user' | 'model'; text: string; id: number };

export function LiveConversationTool() {
    const { toast } = useToast();
    const [appState, setAppState] = useState<AppState>('idle');
    const [turns, setTurns] = useState<Turn[]>([]);
    const [result, setResult] = useState<AnalyzeLiveConversationOutput | null>(null);
    const [audioChunkCount, setAudioChunkCount] = useState<number>(0);

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const recognitionRef = useRef<any>(null);
    const setupCompleteRef = useRef<boolean>(false);
    const turnReceivedAudioRef = useRef<boolean>(false);

    // For AI audio playback queue
    const nextPlayTimeRef = useRef<number>(0);

    const endConversation = useCallback(async () => {
        // Cleanup all media and sockets
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(console.warn);
            audioContextRef.current = null;
        }
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }

        setAppState('analyzing');

        try {
            // Build full transcript
            const fullTranscript = turns.map(t => `${t.role === 'user' ? 'Student' : 'AI'}: ${t.text}`).join('\n');
            if (fullTranscript.trim().length > 10) {
                const res = await analyzeLiveConversation({ transcript: fullTranscript });
                setResult(res);
                setAppState('finished');
            } else {
                toast({ title: "대화 내용이 너무 짧습니다.", description: "분석할 내용이 부족하여 바로 종료합니다." });
                setAppState('idle');
                setTurns([]);
            }
        } catch (err: any) {
            toast({ title: "분석 실패", description: err.message, variant: "destructive" });
            setAppState('error');
        }
    }, [turns, toast]);


    const startConversation = async () => {
        setAppState('connecting');
        setTurns([]);
        setResult(null);
        setAudioChunkCount(0);
        try {
            // Must create AudioContext BEFORE 'await' to guarantee user-gesture token in Chrome
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = audioCtx;
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            const token = await getLiveSessionToken();
            const HOST = "generativelanguage.googleapis.com";
            const url = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${token}`;

            const ws = new WebSocket(url);
            wsRef.current = ws;
            setupCompleteRef.current = false;

            ws.onopen = async () => {
                // Send setup message
                const setupMessage = {
                    setup: {
                        model: "models/gemini-3.1-flash-live-preview",
                        systemInstruction: {
                            parts: [{ text: "You are a friendly native English tutor. Speak naturally and converse interactively with the user." }]
                        },
                        generationConfig: {
                            responseModalities: ["AUDIO"]
                        }
                    }
                };
                ws.send(JSON.stringify(setupMessage));

                // Initialize Web Audio stream
                const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
                micStreamRef.current = stream;

                nextPlayTimeRef.current = 0;

                const source = audioCtx.createMediaStreamSource(stream);
                const processor = audioCtx.createScriptProcessor(4096, 1, 1);
                scriptProcessorRef.current = processor;

                processor.onaudioprocess = (e) => {
                    if (!wsRef.current || !setupCompleteRef.current) return;

                    const float32Data = e.inputBuffer.getChannelData(0);

                    // Convert Float32 to Int16 PCM
                    const pcmData = new Int16Array(float32Data.length);
                    for (let i = 0; i < float32Data.length; i++) {
                        let s = Math.max(-1, Math.min(1, float32Data[i]));
                        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }

                    // Convert to base64
                    const buf = new Uint8Array(pcmData.buffer);
                    let binaryStr = '';
                    for (let i = 0; i < buf.length; i++) { binaryStr += String.fromCharCode(buf[i]); }
                    const base64Data = btoa(binaryStr);

                    if (wsRef.current.readyState === WebSocket.OPEN) {
                        const audioMessage = {
                            realtimeInput: {
                                audio: {
                                    mimeType: "audio/pcm;rate=16000",
                                    data: base64Data
                                }
                            }
                        };
                        wsRef.current.send(JSON.stringify(audioMessage));
                    }
                };

                source.connect(processor);

                // Route mic stream through a muted gain node just to keep the track explicitly 'active' if needed by browser
                const dummyGain = audioCtx.createGain();
                dummyGain.gain.value = 0;
                processor.connect(dummyGain);
                dummyGain.connect(audioCtx.destination);

                // Setup local webkit Speech Recognition for instant user transcription fallback (UI purposes ONLY)
                const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                if (SpeechRecognition) {
                    const recognition = new SpeechRecognition();
                    recognition.continuous = true;
                    recognition.interimResults = true;
                    recognition.lang = 'en-US';
                    recognition.onresult = (event: any) => {
                        const res = event.results[event.results.length - 1];
                        const transcript = res[0].transcript;

                        setTurns(prev => {
                            const newTurns = [...prev];
                            const last = newTurns[newTurns.length - 1];
                            if (last && last.role === 'user') {
                                newTurns[newTurns.length - 1] = { ...last, text: transcript };
                            } else { newTurns.push({ role: 'user', text: transcript, id: Math.random() }); }
                            return newTurns;
                        });
                        // Notice: We NO LONGER send WS payloads here! The WebRTC mediaChunks handles AI input.
                    };
                    recognition.start();
                    recognitionRef.current = recognition;
                }

                toast({ title: "소켓 연결됨", description: "원어민 강사 서버 설정 중..." });
            };

            let currentTurnText = "";

            ws.onmessage = async (event) => {
                try {
                    let textData = event.data;
                    if (textData instanceof Blob) {
                        textData = await textData.text();
                    }
                    const response = JSON.parse(textData);

                    if (response.setupComplete) {
                        setupCompleteRef.current = true;
                        setAppState('connected');
                        toast({ title: "연결 성공", description: "이제 자유롭게 영어로 대화해 보세요!" });
                    }

                    if (response.serverContent?.modelTurn) {
                        const parts = response.serverContent.modelTurn.parts;
                        for (const part of parts) {
                            if (part.text) {
                                setTurns(prev => {
                                    const newTurns = [...prev];
                                    const last = newTurns[newTurns.length - 1];
                                    if (last && last.role === 'model') {
                                        newTurns[newTurns.length - 1] = { ...last, text: last.text + " " + part.text };
                                    } else { newTurns.push({ role: 'model', text: part.text, id: Math.random() }); }
                                    return newTurns;
                                });
                            }

                            if (part.inlineData && part.inlineData.data) {
                                turnReceivedAudioRef.current = true;
                                setAudioChunkCount(c => c + 1);
                                // Play audio buffer
                                try {
                                    if (audioContextRef.current) {
                                        const binaryString = atob(part.inlineData.data);
                                        const len = binaryString.length;
                                        const bytes = new Uint8Array(len);
                                        for (let i = 0; i < len; i++) {
                                            bytes[i] = binaryString.charCodeAt(i);
                                        }

                                        // The API returns 24kHz PCM Int16 raw data by default for Live streaming
                                        const numSamples = bytes.length / 2;
                                        const float32Data = new Float32Array(numSamples);
                                        const dataView = new DataView(bytes.buffer);
                                        for (let i = 0; i < numSamples; i++) {
                                            const int16 = dataView.getInt16(i * 2, true);
                                            float32Data[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7FFF;
                                        }

                                        const audioBuffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
                                        audioBuffer.getChannelData(0).set(float32Data);

                                        const source = audioContextRef.current.createBufferSource();
                                        source.buffer = audioBuffer;
                                        source.connect(audioContextRef.current.destination);

                                        const currentTime = audioContextRef.current.currentTime;
                                        const scheduledTime = Math.max(currentTime, nextPlayTimeRef.current);
                                        source.start(scheduledTime);
                                        nextPlayTimeRef.current = scheduledTime + audioBuffer.duration;
                                    }
                                } catch (e) {
                                    console.error("Audio playback error", e);
                                }
                            }
                        }
                    }

                    if (response.serverContent?.turnComplete) {
                        const finalTurnText = currentTurnText;
                        currentTurnText = ""; // reset for next turn

                        // Execute seamless TTS Fallback if native Audio was suppressed
                        if (!turnReceivedAudioRef.current && finalTurnText.trim() !== "") {
                            generateTtsByModelFlow({ text: finalTurnText, model: "googleai/gemini-3.1-flash-tts-preview" })
                                .then(async (res) => {
                                    if (audioContextRef.current) {
                                        try {
                                            const base64Data = res.audioDataUri.split(',')[1];
                                            const binaryString = atob(base64Data);
                                            const len = binaryString.length;
                                            const bytes = new Uint8Array(len);
                                            for (let i = 0; i < len; i++) {
                                                bytes[i] = binaryString.charCodeAt(i);
                                            }
                                            const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);
                                            const source = audioContextRef.current.createBufferSource();
                                            source.buffer = audioBuffer;
                                            source.connect(audioContextRef.current.destination);
                                            source.start(0);
                                        } catch (e) {
                                            console.error("Fallback TTS Decode/Play Error:", e);
                                        }
                                    }
                                })
                                .catch(e => {
                                    console.error("Fallback TTS Generation Error:", e);
                                });
                        }

                        turnReceivedAudioRef.current = false;
                    }

                    // Handle Live API transcriptions
                    const { inputTranscription, outputTranscription } = response.serverContent || {};
                    if (inputTranscription?.text) {
                        setTurns(prev => {
                            const newTurns = [...prev];
                            const last = newTurns[newTurns.length - 1];
                            // The API sends the cumulative text for the turn, so we replace, we DO NOT append.
                            if (last && last.role === 'user') {
                                newTurns[newTurns.length - 1] = { ...last, text: inputTranscription.text };
                            } else { newTurns.push({ role: 'user', text: inputTranscription.text, id: Math.random() }); }
                            return newTurns;
                        });
                    }
                    if (outputTranscription?.text) {
                        setTurns(prev => {
                            const newTurns = [...prev];
                            const last = newTurns[newTurns.length - 1];
                            // The API sends incremental deltas for outputTranscription, so we MUST append immutable
                            if (last && last.role === 'model') {
                                newTurns[newTurns.length - 1] = { ...last, text: last.text + " " + outputTranscription.text };
                            } else { newTurns.push({ role: 'model', text: outputTranscription.text, id: Math.random() }); }
                            return newTurns;
                        });
                    }
                } catch (err) {
                    console.error("WebSocket Message Parse Error:", err);
                }
            };

            ws.onclose = (e) => {
                console.log("WebSocket Closed:", e.code, e.reason);
                if (appState === 'connected') endConversation();
            };

            ws.onerror = (err) => {
                console.error("WebSocket Error:", err);
                toast({ title: "연결 오류", description: "서버와의 소켓 연결이 끊어졌습니다.", variant: "destructive" });
                endConversation();
            };

        } catch (e: any) {
            toast({ title: "시작 오류", description: e.message, variant: "destructive" });
            setAppState('error');
        }
    };

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Mic className={appState === 'connected' ? 'text-red-500 animate-pulse' : ''} />
                        실시간 원어민 프리토킹 (Live API)
                    </CardTitle>
                    <CardDescription>
                        클릭 한 번으로 원어민 AI 강사와 딜레이 없는 실시간 대화를 나눌 수 있습니다. 대화가 끝나면 분석 리포트가 생성됩니다.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {appState === 'idle' || appState === 'finished' || appState === 'error' ? (
                        <Button size="lg" className="w-full text-lg h-16 bg-blue-600 hover:bg-blue-700" onClick={startConversation}>
                            <Play className="mr-2 h-6 w-6" /> 대화 원격 연결하기
                        </Button>
                    ) : appState === 'connecting' ? (
                        <Button size="lg" disabled className="w-full text-lg h-16">
                            <Loader2 className="mr-2 h-6 w-6 animate-spin" /> 원어민 강사 연결 중...
                        </Button>
                    ) : appState === 'connected' ? (
                        <Button size="lg" variant="destructive" className="w-full text-lg h-16 animate-pulse shadow-lg" onClick={endConversation}>
                            <Square className="mr-2 h-6 w-6" /> 대화 종료 및 분석 받기
                        </Button>
                    ) : (
                        <Button size="lg" disabled className="w-full text-lg h-16">
                            <Loader2 className="mr-2 h-6 w-6 animate-spin" /> 대화 기록 분석 중...
                        </Button>
                    )}

                    <ScrollArea className="h-64 border rounded-md p-4 bg-slate-50 dark:bg-slate-900 border-dashed">
                        {turns.length === 0 && appState !== 'connected' && (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                여기에 실시간 대화 기록이 표시됩니다.
                            </div>
                        )}
                        {turns.map(turn => (
                            <div key={turn.id} className={`mb-3 flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-3 rounded-xl max-w-[80%] ${turn.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                    <div className="flex items-center gap-1 mb-1 font-bold text-xs opacity-70">
                                        {turn.role === 'user' ? <><User className="h-3 w-3" /> 나 (Student)</> : <><Bot className="h-3 w-3" /> 선생님 (AI)</>}
                                    </div>
                                    <div className="text-sm">{turn.text}</div>
                                </div>
                            </div>
                        ))}
                    </ScrollArea>
                </CardContent>
                {appState === 'connected' && (
                    <div className="px-6 pb-4 text-xs text-muted-foreground flex justify-between items-center">
                        <span>수신된 오디오 청크: {audioChunkCount}</span>
                    </div>
                )}
            </Card>

            {appState === 'finished' && result && (
                <div className="grid gap-4 mt-6 animate-in slide-in-from-bottom-4 fade-in">
                    <Card>
                        <CardHeader className="bg-primary/5 pb-4 border-b">
                            <CardTitle className="flex justify-between items-center text-lg">
                                <span>종합 대화 점수</span>
                                <span className="text-2xl font-bold text-primary">{result.overallScore} / 100</span>
                            </CardTitle>
                            <Progress value={result.overallScore} className="h-3 mt-2" />
                        </CardHeader>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="border-pink-100 dark:border-pink-900">
                            <CardHeader className="pb-2 bg-pink-50/50 dark:bg-pink-950/20">
                                <CardTitle className="text-base text-pink-700 dark:text-pink-400">문법 및 어휘 교정 (Grammar)</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 text-sm whitespace-pre-wrap leading-relaxed">
                                {result.grammarFeedback}
                            </CardContent>
                        </Card>
                        <Card className="border-emerald-100 dark:border-emerald-900">
                            <CardHeader className="pb-2 bg-emerald-50/50 dark:bg-emerald-950/20">
                                <CardTitle className="text-base text-emerald-700 dark:text-emerald-400">유창성 및 자연스러움 (Fluency)</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 text-sm whitespace-pre-wrap leading-relaxed">
                                {result.fluencyFeedback}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-blue-500" /> 핵심 총평 (Overall)</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 markdown-content text-sm leading-relaxed p-6 bg-slate-50 dark:bg-slate-900/50 rounded-b-lg">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {result.overallFeedback}
                            </ReactMarkdown>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
