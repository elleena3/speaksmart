"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mic, Square, Loader2, Play, CheckCircle2, User, Bot, AlertTriangle, RefreshCw, AudioLines, Download, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    const [selectedVoice, setSelectedVoice] = useState<string>("Aoede");
    const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

    // FIX: Using mutable refs to avoid stale closures in event listeners
    const appStateRef = useRef<AppState>('idle');
    const turnsRef = useRef<Turn[]>([]);

    // Sync React states with refs
    useEffect(() => { appStateRef.current = appState; }, [appState]);
    useEffect(() => { turnsRef.current = turns; }, [turns]);

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const recognitionRef = useRef<any>(null);
    const setupCompleteRef = useRef<boolean>(false);
    const turnReceivedAudioRef = useRef<boolean>(false);

    // Audio recording logic
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const mixDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

    const nextPlayTimeRef = useRef<number>(0);

    const endConversation = useCallback(async () => {
        if (appStateRef.current === 'finished' || appStateRef.current === 'analyzing') return;

        // Stop the recorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }

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
            const currentTurns = turnsRef.current;
            const fullTranscript = currentTurns.map(t => `${t.role === 'user' ? 'Student' : 'AI'}: ${t.text}`).join('\n');
            if (fullTranscript.trim().length > 10) {
                // Gemini app uses Gemini 3.1 Pro for high fidelity evaluation
                const res = await analyzeLiveConversation({
                    transcript: fullTranscript,
                    evaluationModel: "googleai/gemini-3.1-pro-preview"
                });
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
    }, [toast]);

    const startConversation = async () => {
        if (appStateRef.current !== 'idle' && appStateRef.current !== 'finished' && appStateRef.current !== 'error') return;

        setAppState('connecting');
        setTurns([]);
        setResult(null);
        setAudioChunkCount(0);
        setRecordingUrl(null);
        audioChunksRef.current = [];

        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = audioCtx;
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            // Create Audio Destination Node to record both mic + AI output
            const mixDest = audioCtx.createMediaStreamDestination();
            mixDestinationRef.current = mixDest;

            // Setup Media Recorder for the mixed stream
            // @ts-ignore
            const recorder = new MediaRecorder(mixDest.stream, { mimeType: 'audio/webm' });
            recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setRecordingUrl(url);
            };
            mediaRecorderRef.current = recorder;
            recorder.start();

            const token = await getLiveSessionToken();
            const HOST = "generativelanguage.googleapis.com";
            const url = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${token}`;

            const ws = new WebSocket(url);
            wsRef.current = ws;
            setupCompleteRef.current = false;

            ws.onopen = async () => {
                const setupMessage = {
                    setup: {
                        model: "models/gemini-3.1-flash-live-preview",
                        systemInstruction: {
                            parts: [{ text: "You are a friendly native English tutor. Speak naturally and converse interactively with the user." }]
                        },
                        generationConfig: {
                            responseModalities: ["AUDIO"],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: selectedVoice
                                    }
                                }
                            }
                        }
                    }
                };
                ws.send(JSON.stringify(setupMessage));

                const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
                micStreamRef.current = stream;

                nextPlayTimeRef.current = 0;

                const source = audioCtx.createMediaStreamSource(stream);
                const processor = audioCtx.createScriptProcessor(4096, 1, 1);
                scriptProcessorRef.current = processor;

                // Send user mic to mixDest for recording
                source.connect(mixDest);

                processor.onaudioprocess = (e) => {
                    if (!wsRef.current || !setupCompleteRef.current) return;
                    const float32Data = e.inputBuffer.getChannelData(0);
                    const pcmData = new Int16Array(float32Data.length);
                    for (let i = 0; i < float32Data.length; i++) {
                        let s = Math.max(-1, Math.min(1, float32Data[i]));
                        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
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
                const dummyGain = audioCtx.createGain();
                dummyGain.gain.value = 0;
                processor.connect(dummyGain);
                dummyGain.connect(audioCtx.destination);
                (window as any)._dummyGainRef = dummyGain;

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
                    };

                    recognition.onend = () => {
                        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                            try { recognition.start(); } catch (e) { }
                        }
                    };

                    try { recognition.start(); } catch (e) { }
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
                                try {
                                    if (audioContextRef.current) {
                                        const binaryString = atob(part.inlineData.data);
                                        const len = binaryString.length;
                                        const bytes = new Uint8Array(len);
                                        for (let i = 0; i < len; i++) {
                                            bytes[i] = binaryString.charCodeAt(i);
                                        }

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

                                        // Output AI to speakers AND to recorder!
                                        source.connect(audioContextRef.current.destination);
                                        if (mixDestinationRef.current) source.connect(mixDestinationRef.current);

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
                        currentTurnText = "";

                        if (!turnReceivedAudioRef.current && finalTurnText.trim() !== "") {
                            generateTtsByModelFlow({ text: finalTurnText, model: "googleai/gemini-3.1-flash-tts-preview" })
                                .then(async (res) => {
                                    if (audioContextRef.current) {
                                        try {
                                            const base64Data = res.audioDataUri.split(',')[1];
                                            const binaryString = atob(base64Data);
                                            const len = binaryString.length;
                                            const bytes = new Uint8Array(len);
                                            for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
                                            const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);
                                            const source = audioContextRef.current.createBufferSource();
                                            source.buffer = audioBuffer;

                                            // Output AI TTS to speakers AND to recorder
                                            source.connect(audioContextRef.current.destination);
                                            if (mixDestinationRef.current) source.connect(mixDestinationRef.current);

                                            source.start(0);
                                        } catch (e) {
                                            console.error("Fallback TTS Decode/Play Error:", e);
                                        }
                                    }
                                })
                                .catch(e => console.error("Fallback TTS Generation Error:", e));
                        }
                        turnReceivedAudioRef.current = false;
                    }

                    const { inputTranscription, outputTranscription } = response.serverContent || {};
                    if (inputTranscription?.text) {
                        setTurns(prev => {
                            const newTurns = [...prev];
                            const last = newTurns[newTurns.length - 1];
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
                // FIX: Checking the ref, not the stale closure value!
                if (appStateRef.current === 'connected') {
                    endConversation();
                }
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

    const handleSavePDF = () => {
        if (!result) return;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>원어민 대화 리포트</title>
                        <style>
                            body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; padding: 20px; color: #333; }
                            h1, h2, h3 { color: #111; }
                        </style>
                    </head>
                    <body>
                        <h1>대화 피드백 리포트</h1>
                        <p><strong>총점:</strong> ${result.overallScore} / 100</p>
                        <h3>문법 및 어휘 (Grammar)</h3>
                        <p>${result.grammarFeedback}</p>
                        <h3>유창성 (Fluency)</h3>
                        <p>${result.fluencyFeedback}</p>
                        <h3>총평 (Overall)</h3>
                        <div class="markdown-body">
                            ${result.overallFeedback}
                        </div>
                        <br/>
                         <h3>전체 대화 스크립트</h3>
                        <pre>${turns.map(t => `${t.role === 'user' ? 'Student' : 'AI'}: ${t.text}`).join('\n')}</pre>
                        <script>window.print(); window.close();</script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Mic className={appState === 'connected' ? 'text-red-500 animate-pulse' : ''} />
                            Google AI 원어민 프리토킹 (Live API)
                        </div>
                        <div className="w-[200px]">
                            <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={appState !== 'idle' && appState !== 'finished'}>
                                <SelectTrigger>
                                    <SelectValue placeholder="목소리 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Aoede">Aoede (여성-기본)</SelectItem>
                                    <SelectItem value="Kore">Kore (여성-단정한)</SelectItem>
                                    <SelectItem value="Puck">Puck (남성-활기참)</SelectItem>
                                    <SelectItem value="Charon">Charon (남성-진중함)</SelectItem>
                                    <SelectItem value="Fenrir">Fenrir (남성-묵직함)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 text-sm mt-2 font-medium">
                        <span className="bg-blue-100 text-blue-800 px-2 flex items-center gap-1 rounded">🗣 통화엔진: gemini-3.1-flash-live</span>
                        <span className="bg-emerald-100 flex items-center gap-1 text-emerald-800 px-2 rounded">📝 평가엔진: gemini-3.1-pro-preview</span>
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
                            <Square className="mr-2 h-6 w-6" /> 대화 종료 및 평가 받기
                        </Button>
                    ) : (
                        <Button size="lg" disabled className="w-full text-lg h-16 bg-emerald-600 font-bold opacity-100">
                            <Loader2 className="mr-2 h-6 w-6 animate-spin" /> 선생님이 대화 분석 리포트를 작성중입니다!
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
            </Card>

            {appState === 'finished' && result && (
                <div className="grid gap-4 mt-6 animate-in slide-in-from-bottom-4 fade-in">
                    <Card>
                        <CardHeader className="bg-emerald-500/10 pb-4 border-b">
                            <CardTitle className="flex justify-between items-center text-lg">
                                <span>종합 프리토킹 점수</span>
                                <span className="text-2xl font-bold text-emerald-600">{result.overallScore} / 100</span>
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

                    <div className="flex justify-end gap-2 mt-2 border-t pt-4">
                        {recordingUrl && (
                            <Button size="sm" variant="outline" className="border-blue-200 bg-blue-50 hover:bg-blue-100" asChild>
                                <a href={recordingUrl} download="live-conversation-recording.webm" className="flex items-center">
                                    <Download className="h-4 w-4 mr-2" /> 음성 파일 다운로드
                                </a>
                            </Button>
                        )}
                        <Button size="sm" variant="outline" className="border-emerald-200 bg-emerald-50 hover:bg-emerald-100" onClick={handleSavePDF}>
                            <FileText className="h-4 w-4 mr-2" /> 평가 리포트 PDF 저장
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
