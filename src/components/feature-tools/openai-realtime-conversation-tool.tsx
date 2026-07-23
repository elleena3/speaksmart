"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mic, Square, Loader2, Play, User, Bot, Rss, Download, FileText, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getOpenAiLiveSessionToken } from "@/ai/flows/get-openai-live-session-token";
import { analyzeLiveConversation, type AnalyzeLiveConversationOutput } from "@/ai/flows/analyze-live-conversation-flow";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Progress } from "@/components/ui/progress";

type AppState = 'idle' | 'connecting' | 'connected' | 'analyzing' | 'finished' | 'error';
type Turn = { role: 'user' | 'model'; text: string; id: number };

export function OpenAiRealtimeConversationTool() {
    const { toast } = useToast();
    const [appState, setAppState] = useState<AppState>('idle');
    const [turns, setTurns] = useState<Turn[]>([]);
    const [result, setResult] = useState<AnalyzeLiveConversationOutput | null>(null);

    const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-mini-realtime-preview");
    const [selectedVoice, setSelectedVoice] = useState<string>("alloy");
    const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

    // FIX: Using mutable refs to avoid stale closures in event listeners
    const appStateRef = useRef<AppState>('idle');
    const turnsRef = useRef<Turn[]>([]);
    useEffect(() => { appStateRef.current = appState; }, [appState]);
    useEffect(() => { turnsRef.current = turns; }, [turns]);

    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    // Audio recording logic
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // UI hack to avoid garaging collection of streams
    const keepaliveStreamRef = useRef<MediaStream | null>(null);

    const endConversation = useCallback(async () => {
        if (appStateRef.current === 'finished' || appStateRef.current === 'analyzing') return;

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close().catch(console.warn);
            audioContextRef.current = null;
        }

        if (keepaliveStreamRef.current) {
            keepaliveStreamRef.current.getTracks().forEach(t => t.stop());
            keepaliveStreamRef.current = null;
        }

        setAppState('analyzing');

        try {
            const currentTurns = turnsRef.current;
            const fullTranscript = currentTurns.map(t => `${t.role === 'user' ? 'Student' : 'AI'}: ${t.text}`).join('\n');
            if (fullTranscript.trim().length > 10) {
                // USER REQUEST: Use gpt-5.6-sol for OpenAI rating
                const res = await analyzeLiveConversation({
                    transcript: fullTranscript,
                    evaluationModel: "openai/gpt-5.6-sol"
                });
                setResult(res);
                setAppState('finished');
            } else {
                toast({ title: "대화 내용이 너무 짧습니다.", description: "분석할 내용이 부족하여 바로 종료합니다." });
                setAppState('idle');
                setTurns([]);
            }
        } catch (err: any) {
            toast({ title: "분석 실패", description: err.message || "알 수 없는 에러", variant: "destructive" });
            setAppState('error');
        }
    }, [toast]);

    const startConversation = async () => {
        if (appStateRef.current !== 'idle' && appStateRef.current !== 'finished' && appStateRef.current !== 'error') return;

        setAppState('connecting');
        setTurns([]);
        setResult(null);
        setRecordingUrl(null);
        audioChunksRef.current = [];

        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioCtx;
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            const mixDest = audioCtx.createMediaStreamDestination();

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

            // 1. Get ephemeral token from backend
            const tokenResponse = await getOpenAiLiveSessionToken({
                model: selectedModel === "gpt-4o-mini-realtime-preview" ? "gpt-4o-mini-realtime-preview-2024-12-17" : "gpt-4o-realtime-preview-2024-12-17",
                voice: selectedVoice as any
            });
            const ephemeralKey = tokenResponse.client_secret.value;

            // 2. Create Peer Connection
            const pc = new RTCPeerConnection();
            peerConnectionRef.current = pc;

            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                    // Fix stale closures by checking ref!
                    if (appStateRef.current === 'connected') {
                        endConversation();
                    }
                }
            };

            // 3. Play audio received from AI + Record it
            pc.ontrack = e => {
                const aiNode = audioCtx.createMediaStreamSource(e.streams[0]);
                // AI audio goes to speakers
                aiNode.connect(audioCtx.destination);
                // And AI audio goes to recorder
                aiNode.connect(mixDest);
            };

            // 4. Capture Local Mic
            const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
            keepaliveStreamRef.current = ms;
            pc.addTrack(ms.getTracks()[0]);

            // Mic audio goes to recorder ONLY (avoid local echo)
            const micNode = audioCtx.createMediaStreamSource(ms);
            micNode.connect(mixDest);

            // 5. Setup Data Channel to receive transcriptions
            const dc = pc.createDataChannel("oai-events");
            dataChannelRef.current = dc;

            dc.addEventListener("message", (e) => {
                try {
                    const event = JSON.parse(e.data);

                    if (event.type === "conversation.item.input_audio_transcription.completed") {
                        setTurns(prev => [...prev, { role: 'user', text: event.transcript, id: Math.random() }]);
                    }

                    if (event.type === "response.audio_transcript.done") {
                        setTurns(prev => [...prev, { role: 'model', text: event.transcript, id: Math.random() }]);
                    }

                } catch (err) {
                    console.error("Data channel parse error:", err);
                }
            });

            // 6. Offer / Answer negotiation
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const baseUrl = "https://api.openai.com/v1/realtime";
            const realModelName = selectedModel === "gpt-4o-mini-realtime-preview" ? "gpt-4o-mini-realtime-preview-2024-12-17" : "gpt-4o-realtime-preview-2024-12-17";

            const sdpResponse = await fetch(`${baseUrl}?model=${realModelName}`, {
                method: "POST",
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${ephemeralKey}`,
                    "Content-Type": "application/sdp"
                }
            });

            if (!sdpResponse.ok) {
                throw new Error("Failed to connect to OpenAI WebRTC");
            }

            const answer = {
                type: "answer" as RTCSdpType,
                sdp: await sdpResponse.text()
            };

            await pc.setRemoteDescription(answer);

            setAppState('connected');
            toast({ title: "연결 성공", description: "AI와 통화를 시작합니다!" });

        } catch (e: any) {
            console.error(e);
            toast({ title: "연결 오류", description: e.message || "오류가 발생했습니다.", variant: "destructive" });
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
                        <title>원어민 대화 리포트 (OpenAI)</title>
                        <style>
                            body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; padding: 20px; color: #333; }
                            h1, h2, h3 { color: #111; }
                        </style>
                    </head>
                    <body>
                        <h1>대화 피드백 리포트 (Powered by GPT-5.6-Sol)</h1>
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
                            <Rss className={appState === 'connected' ? 'text-green-500 animate-pulse' : 'text-slate-400'} />
                            OpenAI 실시간 웹 화상통화
                        </div>
                        <div className="w-[450px] flex gap-2">
                            <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={appState !== 'idle' && appState !== 'finished'}>
                                <SelectTrigger>
                                    <SelectValue placeholder="목소리 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="alloy">Alloy (여성-중립)</SelectItem>
                                    <SelectItem value="echo">Echo (남성-부드러움)</SelectItem>
                                    <SelectItem value="shimmer">Shimmer (여성-밝음)</SelectItem>
                                    <SelectItem value="ash">Ash (남성-진지함)</SelectItem>
                                    <SelectItem value="ballad">Ballad (남성-차분함)</SelectItem>
                                    <SelectItem value="coral">Coral (여성-상쾌함)</SelectItem>
                                    <SelectItem value="sage">Sage (여성-전문적)</SelectItem>
                                    <SelectItem value="verse">Verse (남성-에너제틱)</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={appState !== 'idle' && appState !== 'finished'}>
                                <SelectTrigger>
                                    <SelectValue placeholder="AI 모델 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gpt-4o-mini-realtime-preview">gpt-realtime-2.1-mini</SelectItem>
                                    <SelectItem value="gpt-4o-realtime-preview">gpt-realtime-2.1</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 text-sm mt-2 font-medium">
                        <span className="bg-blue-100 text-blue-800 px-2 flex items-center gap-1 rounded">🗣 통화엔진: {selectedModel}</span>
                        <span className="bg-emerald-100 flex items-center gap-1 text-emerald-800 px-2 rounded">📝 평가엔진: gpt-5.6-sol</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {appState === 'idle' || appState === 'finished' || appState === 'error' ? (
                        <Button size="lg" className="w-full text-lg h-16 bg-emerald-600 hover:bg-emerald-700" onClick={startConversation}>
                            <Play className="mr-2 h-6 w-6" /> 대화 웹 원격 연결하기
                        </Button>
                    ) : appState === 'connecting' ? (
                        <Button size="lg" disabled className="w-full text-lg h-16">
                            <Loader2 className="mr-2 h-6 w-6 animate-spin" /> OpenAI 서버 연결 중...
                        </Button>
                    ) : appState === 'connected' ? (
                        <Button size="lg" variant="destructive" className="w-full text-lg h-16 animate-pulse shadow-lg" onClick={endConversation}>
                            <Square className="mr-2 h-6 w-6" /> 대화 완전 종료 및 결과 보기
                        </Button>
                    ) : (
                        <Button size="lg" disabled className="w-full text-lg h-16 bg-blue-600 font-bold opacity-100">
                            <Loader2 className="mr-2 h-6 w-6 animate-spin" /> GPT-5.6 평가 모델이 대화를 분석중입니다!
                        </Button>
                    )}

                    <ScrollArea className="h-64 border rounded-md p-4 bg-slate-50 dark:bg-slate-900 border-dashed">
                        {turns.length === 0 && appState !== 'connected' && (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                여기에 실시간 대화 자막이 나타납니다.
                            </div>
                        )}
                        {turns.map(turn => (
                            <div key={turn.id} className={`mb-3 flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-3 rounded-xl max-w-[80%] ${turn.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                    <div className="flex items-center gap-1 mb-1 font-bold text-xs opacity-70">
                                        {turn.role === 'user' ? <><User className="h-3 w-3" /> 나 (Student)</> : <><Bot className="h-3 w-3" /> 지피티 (GPT)</>}
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

                    <div className="flex justify-end gap-2 mb-2">
                        {recordingUrl && (
                            <a href={recordingUrl} download="openai-live-conversation.webm" className="flex items-center">
                                <Button size="sm" variant="outline" className="border-blue-200">
                                    <Download className="h-4 w-4 mr-2" /> 음성 녹음 다운로드 (WebM)
                                </Button>
                            </a>
                        )}
                        <Button size="sm" variant="outline" className="border-blue-200" onClick={handleSavePDF}>
                            <FileText className="h-4 w-4 mr-2" /> 종합 리포트 PDF 저장
                        </Button>
                    </div>

                    <Card>
                        <CardHeader className="bg-primary/5 pb-4 border-b">
                            <CardTitle className="flex justify-between items-center text-lg">
                                <span>종합 분석 점수</span>
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
                            <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-blue-500" /> 솔 (Sol) 의 핵심 피드백</CardTitle>
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
