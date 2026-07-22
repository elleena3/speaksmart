"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mic, Square, Loader2, Play, User, Bot, Rss } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getOpenAiLiveSessionToken } from "@/ai/flows/get-openai-live-session-token";

type AppState = 'idle' | 'connecting' | 'connected' | 'error';
type Turn = { role: 'user' | 'model'; text: string; id: number };

export function OpenAiRealtimeConversationTool() {
    const { toast } = useToast();
    const [appState, setAppState] = useState<AppState>('idle');
    const [turns, setTurns] = useState<Turn[]>([]);

    // Defaulting to the cheaper "mini" model as requested
    const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-mini-realtime-preview");
    const [selectedVoice, setSelectedVoice] = useState<string>("alloy");

    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);

    const endConversation = useCallback(async () => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
        }
        if (audioElementRef.current) {
            audioElementRef.current.srcObject = null;
        }
        setAppState('idle');
    }, []);

    const startConversation = async () => {
        setAppState('connecting');
        setTurns([]);

        try {
            // 1. Get ephemeral token from backend
            const tokenResponse = await getOpenAiLiveSessionToken({
                model: selectedModel === "gpt-4o-mini-realtime-preview" ? "gpt-4o-mini-realtime-preview-2024-12-17" : "gpt-4o-realtime-preview-2024-12-17",
                voice: selectedVoice as any
            });
            const ephemeralKey = tokenResponse.client_secret.value;

            // 2. Create Peer Connection
            const pc = new RTCPeerConnection();
            peerConnectionRef.current = pc;

            // 3. Play audio received from AI
            if (!audioElementRef.current) {
                audioElementRef.current = document.createElement("audio");
                audioElementRef.current.autoplay = true;
            }
            pc.ontrack = e => {
                if (audioElementRef.current) {
                    audioElementRef.current.srcObject = e.streams[0];
                }
            };

            // 4. Capture Local Mic
            const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = ms;
            pc.addTrack(ms.getTracks()[0]);

            // 5. Setup Data Channel to receive transcriptions
            const dc = pc.createDataChannel("oai-events");
            dataChannelRef.current = dc;

            dc.addEventListener("message", (e) => {
                try {
                    const event = JSON.parse(e.data);

                    // Handle user's finalized transcript
                    if (event.type === "conversation.item.input_audio_transcription.completed") {
                        setTurns(prev => [...prev, { role: 'user', text: event.transcript, id: Math.random() }]);
                    }

                    // Handle AI's finalized text responses
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
            // Map our UI selection to actual OpenAI model string formats
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
            endConversation();
        }
    };

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Rss className={appState === 'connected' ? 'text-green-500 animate-pulse' : 'text-slate-400'} />
                            OpenAI 실시간 통화 대화
                        </div>
                        <div className="w-[450px] flex gap-2">
                            <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={appState !== 'idle'}>
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
                            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={appState !== 'idle'}>
                                <SelectTrigger>
                                    <SelectValue placeholder="AI 모델 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gpt-4o-mini-realtime-preview">gpt-realtime-2.1-mini (기본, 고속)</SelectItem>
                                    <SelectItem value="gpt-4o-realtime-preview">gpt-realtime-2.1 (고성능)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardTitle>
                    <CardDescription>
                        WebRTC를 사용하는 OpenAI 전용 초저지연 실시간 양방향 대화 도구입니다.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {appState === 'idle' || appState === 'error' ? (
                        <Button size="lg" className="w-full text-lg h-16 bg-emerald-600 hover:bg-emerald-700" onClick={startConversation}>
                            <Play className="mr-2 h-6 w-6" /> 대화 원격 연결하기
                        </Button>
                    ) : appState === 'connecting' ? (
                        <Button size="lg" disabled className="w-full text-lg h-16">
                            <Loader2 className="mr-2 h-6 w-6 animate-spin" /> OpenAI 서버 연결 중...
                        </Button>
                    ) : (
                        <Button size="lg" variant="destructive" className="w-full text-lg h-16 animate-pulse shadow-lg" onClick={endConversation}>
                            <Square className="mr-2 h-6 w-6" /> 대화 완전 종료
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
                                        {turn.role === 'user' ? <><User className="h-3 w-3" /> 나 (Student)</> : <><Bot className="h-3 w-3" /> 인공지능 (GPT)</>}
                                    </div>
                                    <div className="text-sm">{turn.text}</div>
                                </div>
                            </div>
                        ))}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
