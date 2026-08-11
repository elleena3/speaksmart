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
import { analyzeLiveConversation, analyzeLivePronunciation, type AnalyzeLiveConversationOutput, type PronunciationAnalysis } from "@/ai/flows/analyze-live-conversation-flow";
import { startStudentMicRecorder, type StudentMicRecorder } from "@/lib/student-mic-recorder";
import { PronunciationCard } from "./pronunciation-card";
import { CONVERSATION_MIC_CONSTRAINTS } from "@/lib/mic-constraints";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Progress } from "@/components/ui/progress";
import { GOOGLE_EVALUATION_MODELS, DEFAULT_GOOGLE_EVALUATION_MODEL, shortModelName } from "@/lib/evaluation-models";
import { type EvaluationModel } from "@/lib/types";
import { RecordingPlayback } from "./recording-playback";
import { printConversationReport } from "@/lib/conversation-report";
import { uploadConversationRecording, type UploadState } from "@/lib/upload-recording";

type AppState = 'idle' | 'connecting' | 'connected' | 'analyzing' | 'finished' | 'error';
type Turn = { role: 'user' | 'model'; text: string; id: number };

export function LiveConversationTool() {
    const { toast } = useToast();
    const [appState, setAppState] = useState<AppState>('idle');
    const [turns, setTurns] = useState<Turn[]>([]);
    const [result, setResult] = useState<AnalyzeLiveConversationOutput | null>(null);
    const [pronunciation, setPronunciation] = useState<PronunciationAnalysis | null>(null);
    const [audioChunkCount, setAudioChunkCount] = useState<number>(0);
    const [selectedVoice, setSelectedVoice] = useState<string>("Aoede");
    const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
    const [storedRecordingUrl, setStoredRecordingUrl] = useState<string | null>(null);
    const [uploadState, setUploadState] = useState<UploadState>('idle');
    const [uploadError, setUploadError] = useState<string | null>(null);
    // 업로드는 리포트 생성보다 늦게 끝날 수 있어 ref 로도 들고 있습니다.
    const storedRecordingUrlRef = useRef<string | null>(null);
    // 평가엔진은 통화엔진과 별개입니다. flash 가 훨씬 저렴해 기본값으로 둡니다.
    const [evaluationModel, setEvaluationModel] = useState<EvaluationModel>(DEFAULT_GOOGLE_EVALUATION_MODEL);

    // FIX: Using mutable refs to avoid stale closures in event listeners
    const appStateRef = useRef<AppState>('idle');
    const turnsRef = useRef<Turn[]>([]);
    const evaluationModelRef = useRef<EvaluationModel>(DEFAULT_GOOGLE_EVALUATION_MODEL);

    // Sync React states with refs
    useEffect(() => { appStateRef.current = appState; }, [appState]);
    useEffect(() => { turnsRef.current = turns; }, [turns]);
    useEffect(() => { evaluationModelRef.current = evaluationModel; }, [evaluationModel]);

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
    // 발음 평가용 학생 마이크 전용 녹음 (합본 녹음과 별개)
    const studentMicRef = useRef<StudentMicRecorder | null>(null);

    const nextPlayTimeRef = useRef<number>(0);
    // AI 음성이 스피커로 나가는 구간. 이 동안 마이크로 들어온 소리는 학생 발화로 보지 않습니다.
    const aiSpeakingUntilRef = useRef<number>(0);
    // 서버 전사가 한 번이라도 오면 Web Speech 폴백을 끕니다.
    const serverTranscriptSeenRef = useRef<boolean>(false);

    const endConversation = useCallback(async () => {
        if (appStateRef.current === 'finished' || appStateRef.current === 'analyzing') return;

        // Stop the recorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }

        // AudioContext 를 닫으면 마이크 스트림도 끊기므로, 정지 요청을 먼저 걸어둡니다.
        const studentAudioPromise = studentMicRef.current?.stopAndGetDataUri() ?? Promise.resolve(null);
        studentMicRef.current = null;

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

        // 발음 평가는 학생 목소리만 들어야 하므로 합본이 아닌 마이크 전용 녹음을 씁니다.
        const studentAudio = await studentAudioPromise;

        try {
            const currentTurns = turnsRef.current;
            const fullTranscript = currentTurns.map(t => `${t.role === 'user' ? 'Student' : 'AI'}: ${t.text}`).join('\n');
            if (fullTranscript.trim().length > 10) {
                // 자막 기반 평가와 음성 기반 발음 평가를 동시에 돌립니다.
                const [res, pron] = await Promise.all([
                    analyzeLiveConversation({
                        transcript: fullTranscript,
                        // 이 콜백은 연결 시점에 캡처되므로 ref 로 최신 선택값을 읽습니다.
                        evaluationModel: evaluationModelRef.current
                    }),
                    studentAudio ? analyzeLivePronunciation(studentAudio) : Promise.resolve(null),
                ]);

                if (!res.ok) {
                    toast({ title: "분석 실패", description: res.error, variant: "destructive" });
                    setAppState('error');
                    return;
                }

                setPronunciation(pron);
                setResult(res.data);
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
        setPronunciation(null);
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
                // blob URL 은 즉시 재생용입니다. 탭을 닫으면 사라지므로 별도로 보관합니다.
                setRecordingUrl(URL.createObjectURL(blob));

                setUploadState('uploading');
                setUploadError(null);
                uploadConversationRecording(blob, 'gemini-live')
                    .then(url => {
                        storedRecordingUrlRef.current = url;
                        setStoredRecordingUrl(url);
                        setUploadState('done');
                    })
                    .catch(err => {
                        console.error('녹음 보관 실패:', err);
                        setUploadError(err instanceof Error ? err.message : '알 수 없는 오류');
                        setUploadState('error');
                    });
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
                        // 서버가 보낸 오디오와 받은 오디오를 각각 전사해 줍니다.
                        // 이게 있어야 '학생이 말한 것'과 'AI 가 말한 것'이 출처 단위로 갈립니다.
                        inputAudioTranscription: {},
                        outputAudioTranscription: {},
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

                // 에코 제거를 명시해야 스피커로 나온 AI 목소리가 학생 발화로 전사되지 않습니다.
                const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000, ...CONVERSATION_MIC_CONSTRAINTS } });
                micStreamRef.current = stream;

                nextPlayTimeRef.current = 0;
                aiSpeakingUntilRef.current = 0;
                serverTranscriptSeenRef.current = false;

                const source = audioCtx.createMediaStreamSource(stream);
                const processor = audioCtx.createScriptProcessor(4096, 1, 1);
                scriptProcessorRef.current = processor;

                // Send user mic to mixDest for recording
                source.connect(mixDest);

                // 발음 평가용으로 학생 목소리만 따로 담습니다.
                studentMicRef.current = startStudentMicRecorder(audioCtx, source);

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
                        // Web Speech 는 마이크를 직접 듣기만 할 뿐 누가 말하는지 모릅니다.
                        // 스피커로 나온 AI 목소리가 들어오면 그대로 학생 발화로 기록되므로,
                        // 서버 전사가 한 번이라도 오면 그때부터는 이쪽을 쓰지 않습니다.
                        if (serverTranscriptSeenRef.current) return;

                        // 서버 전사가 없는 환경에서도 AI 가 말하는 동안은 받아쓰지 않습니다.
                        const ctx = audioContextRef.current;
                        if (ctx && ctx.currentTime < aiSpeakingUntilRef.current) return;

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
                                        // 스피커 잔향이 마이크에 늦게 잡히는 것까지 감안해 0.4초 여유를 둡니다.
                                        aiSpeakingUntilRef.current = nextPlayTimeRef.current + 0.4;
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
                        // 서버 전사가 도착했으므로 Web Speech 폴백은 더 이상 쓰지 않습니다.
                        serverTranscriptSeenRef.current = true;
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

        const opened = printConversationReport({
            title: '대화 피드백 리포트 (Gemini Live)',
            subtitle: `평가 모델: ${shortModelName(evaluationModel)}`,
            overallScore: result.overallScore,
            grammarFeedback: result.grammarFeedback,
            fluencyFeedback: result.fluencyFeedback,
            overallFeedback: result.overallFeedback,
            pronunciation: pronunciation
                ? { score: pronunciation.pronunciationScore, feedback: pronunciation.pronunciationFeedback, model: shortModelName(pronunciation.model) }
                : null,
            transcript: turns.map(t => `${t.role === 'user' ? 'Student' : 'AI'}: ${t.text}`).join('\n'),
            recordingUrl: storedRecordingUrl,
        });

        if (!opened) {
            toast({
                title: "팝업이 차단되었습니다",
                description: "브라우저에서 이 사이트의 팝업을 허용한 뒤 다시 시도해주세요.",
                variant: "destructive",
            });
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
                            <Select value={evaluationModel} onValueChange={(v) => setEvaluationModel(v as EvaluationModel)} disabled={appState !== 'idle' && appState !== 'finished'}>
                                <SelectTrigger>
                                    <SelectValue placeholder="평가 모델 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {GOOGLE_EVALUATION_MODELS.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 text-sm mt-2 font-medium">
                        <span className="bg-blue-100 text-blue-800 px-2 flex items-center gap-1 rounded">🗣 통화엔진: gemini-3.1-flash-live</span>
                        <span className="bg-emerald-100 flex items-center gap-1 text-emerald-800 px-2 rounded">📝 평가엔진: {shortModelName(evaluationModel)}</span>
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

                    {/* 분석 성공 여부와 무관하게, 녹음이 있으면 바로 듣고 받을 수 있어야 합니다. */}
                    {recordingUrl && (
                        <RecordingPlayback
                            url={recordingUrl}
                            fileName="live-conversation-recording.webm"
                            storedUrl={storedRecordingUrl}
                            uploadState={uploadState}
                            uploadError={uploadError}
                        />
                    )}
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

                    {pronunciation && <PronunciationCard analysis={pronunciation} />}

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
                        <Button size="sm" variant="outline" className="border-emerald-200 bg-emerald-50 hover:bg-emerald-100" onClick={handleSavePDF}>
                            <FileText className="h-4 w-4 mr-2" /> 평가 리포트 PDF 저장
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
