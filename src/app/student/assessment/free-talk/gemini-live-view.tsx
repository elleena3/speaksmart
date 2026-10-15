"use client"

/**
 * 실시간 대화(Gemini Live) 평가 응시 화면.
 *
 * OpenAI Realtime 화면(realtime-view)과 하는 일이 같습니다. 끊김 없이 말하고,
 * 끝나면 같은 대화 분석 플로우로 채점합니다. 다른 것은 전송 방식뿐입니다.
 *   OpenAI  — WebRTC, 서버 VAD 가 턴을 끊어 줍니다.
 *   여기     — WebSocket, 음성을 PCM 으로 직접 보내고 받습니다.
 *
 * 보안상 중요한 차이: 브라우저에 내려오는 것은 **1시간 만료 OAuth 토큰**입니다.
 * 교사용 Gemini Live 도구는 API 키 원본을 내려보내는데, 학생 수십 명에게 그렇게
 * 하면 학교 유료 키가 그 수만큼 복사됩니다. 그래서 여기서는 Vertex AI 경로를
 * 쓰고 전용 서비스 계정(Vertex 권한만)에서 받은 토큰만 넘깁니다.
 */

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Mic, Square, Loader2, Play, User, Bot, Rss, CornerDownLeft, AlertCircle } from "lucide-react"
import { getVertexLiveToken } from "@/ai/flows/get-vertex-live-token"
import { REALTIME_INSTRUCTIONS } from "@/lib/realtime-config"
import { CONVERSATION_MIC_CONSTRAINTS } from "@/lib/mic-constraints"
import { uploadConversationRecording } from "@/lib/upload-recording"
import { defaultGeminiLiveModel, defaultGeminiLiveVoice, type TeacherAssessment } from "@/lib/types"
import { type ConversationTurn } from "@/lib/types/ai-schemas"
import { cn } from "@/lib/utils"

const SESSION_STORAGE_KEY = 'freeTalkSessionData';
const MIN_STUDENT_CHARS = 20;

/** Live API 가 받는 입력 형식과 돌려주는 출력 형식. 섞으면 잡음만 들립니다. */
const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;

type ViewState = 'idle' | 'connecting' | 'live' | 'ending' | 'error';

function buildInstructions(assessment: TeacherAssessment): string {
  const lines = [REALTIME_INSTRUCTIONS];
  if (assessment.topic) lines.push(`The topic of this assessment is: ${assessment.topic}.`);
  if (assessment.prompt) lines.push(`Follow this guidance from the teacher: ${assessment.prompt}`);
  if (assessment.scenario && assessment.scenario !== 'free-talk') {
    lines.push(`Role-play this situation with the student: ${assessment.scenario.replace(/-/g, ' ')}.`);
  }
  lines.push('Ask one question at a time and wait for the student to answer.');
  return lines.join(' ');
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Float32(-1~1) → 16bit PCM. Live API 가 받는 형식입니다. */
function toPcm16(input: Float32Array): ArrayBuffer {
  const out = new DataView(new ArrayBuffer(input.length * 2));
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out.buffer;
}

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};

const fromBase64 = (b64: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

export function GeminiLiveAssessmentView({ assessment }: { assessment: TeacherAssessment }) {
  const router = useRouter();
  const { toast } = useToast();

  const [state, setState] = useState<ViewState>('idle');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);

  const stateRef = useRef<ViewState>('idle');
  const turnsRef = useRef<ConversationTurn[]>([]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { turnsRef.current = turns; }, [turns]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const endingRef = useRef(false);
  /** 받은 음성을 끊기지 않게 이어 붙이기 위한 재생 커서 */
  const playHeadRef = useRef(0);

  const limitSeconds = assessment.recordingTimeLimit ? assessment.recordingTimeLimit * 60 : 0;

  const teardown = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    try { processorRef.current?.disconnect(); } catch {}
    processorRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    playCtxRef.current?.close().catch(() => {});
    playCtxRef.current = null;
  }, []);

  useEffect(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return () => teardown();
  }, [teardown]);

  useEffect(() => {
    const el = scrollRef.current?.querySelector('div');
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  /** 학생 녹음을 멈추고 Blob 으로 받습니다. */
  const stopRecording = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state !== 'recording') { resolve(null); return; }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        resolve(blob.size === 0 ? null : blob);
      };
      rec.stop();
    });

  const finish = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setState('ending');
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    const blobPromise = stopRecording();
    teardown();

    try {
      const studentBlob = await blobPromise;
      const spoken = turnsRef.current.filter((t) => t.role === 'user').map((t) => t.text).join(' ').trim();

      if (!studentBlob || spoken.length < MIN_STUDENT_CHARS) {
        setFailure('말한 내용이 너무 짧아 채점할 수 없습니다. 다시 연결해 조금 더 길게 대화해 주세요.');
        setState('error');
        endingRef.current = false;
        return;
      }

      // 녹음은 Storage 로 바로 올립니다. data URI 로 바꿔 sessionStorage 에 담으면
      // 몇 분 분량만으로도 용량(약 5MB)을 넘겨 제출이 실패합니다.
      const recordingUrl = await uploadConversationRecording(studentBlob, 'assessment-gemini-live');

      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        studentRecordingDataUri: recordingUrl,
        conversationHistory: turnsRef.current,
        assessment,
      }));
      router.push(`/student/assessment/free-talk/processing?id=${assessment.id}`);
    } catch (e: any) {
      console.error('[Gemini Live 평가] 제출 실패:', e);
      setFailure(e?.message || '대화를 저장하지 못했습니다.');
      setState('error');
      endingRef.current = false;
    }
  }, [assessment, router, teardown]);

  const start = async () => {
    if (state === 'connecting' || state === 'live' || state === 'ending') return;
    setState('connecting');
    setTurns([]);
    setElapsed(0);
    setFailure(null);
    endingRef.current = false;
    chunksRef.current = [];
    playHeadRef.current = 0;

    try {
      const session = await getVertexLiveToken({ model: assessment.geminiLiveModel || defaultGeminiLiveModel });

      // 입력과 출력은 표본율이 달라 컨텍스트를 따로 둡니다.
      const micCtx = new AudioContext({ sampleRate: INPUT_RATE });
      audioCtxRef.current = micCtx;
      if (micCtx.state === 'suspended') await micCtx.resume();
      const playCtx = new AudioContext({ sampleRate: OUTPUT_RATE });
      playCtxRef.current = playCtx;
      if (playCtx.state === 'suspended') await playCtx.resume();

      // 에코 제거를 명시해야 스피커로 나온 AI 목소리가 학생 발화로 전사되지 않습니다.
      const mic = await navigator.mediaDevices.getUserMedia({ audio: CONVERSATION_MIC_CONSTRAINTS });
      micStreamRef.current = mic;

      // 발음 채점은 학생 목소리만 들어야 하므로 마이크 스트림을 그대로 녹음합니다.
      const rec = new MediaRecorder(mic, { mimeType: 'audio/webm' });
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorderRef.current = rec;
      rec.start();

      const ws = new WebSocket(session.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          setup: {
            model: session.modelPath,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: assessment.geminiLiveVoice || defaultGeminiLiveVoice },
                },
              },
            },
            systemInstruction: { parts: [{ text: buildInstructions(assessment) }] },
            // 양쪽 발화를 글로 받아야 채점에 쓸 수 있습니다.
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        }));
      };

      ws.onmessage = async (event) => {
        let text: string;
        // 서버가 Blob 으로 보낼 때가 있어 둘 다 받습니다.
        if (event.data instanceof Blob) text = await event.data.text();
        else text = String(event.data);

        let msg: any;
        try { msg = JSON.parse(text); } catch { return; }

        if (msg.setupComplete) {
          setState('live');
          // 먼저 말을 걸게 합니다. 학생이 무엇부터 할지 몰라 가만히 있는 일을 막습니다.
          ws.send(JSON.stringify({
            clientContent: {
              turns: [{ role: 'user', parts: [{ text: 'Please greet me and ask your first question.' }] }],
              turnComplete: true,
            },
          }));

          timerRef.current = setInterval(() => {
            setElapsed((prev) => {
              const next = prev + 1;
              if (limitSeconds && next >= limitSeconds) finish();
              return next;
            });
          }, 1000);
          return;
        }

        const sc = msg.serverContent;
        if (!sc) return;

        if (sc.inputTranscription?.text) {
          const t = sc.inputTranscription.text;
          setTurns((prev) => {
            const last = prev[prev.length - 1];
            // 전사는 조각으로 와서 같은 턴이면 이어 붙입니다.
            if (last && last.role === 'user') {
              return [...prev.slice(0, -1), { ...last, text: last.text + t }];
            }
            return [...prev, { role: 'user', text: t }];
          });
        }

        if (sc.outputTranscription?.text) {
          const t = sc.outputTranscription.text;
          setTurns((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'model') {
              return [...prev.slice(0, -1), { ...last, text: last.text + t }];
            }
            return [...prev, { role: 'model', text: t }];
          });
        }

        for (const part of sc.modelTurn?.parts ?? []) {
          const b64 = part.inlineData?.data;
          if (!b64) continue;
          const bytes = fromBase64(b64);
          const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
          const buf = playCtx.createBuffer(1, pcm.length, OUTPUT_RATE);
          const ch = buf.getChannelData(0);
          for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
          const src = playCtx.createBufferSource();
          src.buffer = buf;
          src.connect(playCtx.destination);
          // 조각을 이어 붙여 재생해야 끊기지 않습니다.
          const startAt = Math.max(playCtx.currentTime, playHeadRef.current);
          src.start(startAt);
          playHeadRef.current = startAt + buf.duration;
        }

        // 학생이 끼어들면 남은 재생을 버려야 말이 겹치지 않습니다.
        if (sc.interrupted) playHeadRef.current = playCtx.currentTime;
      };

      ws.onerror = () => {
        if (stateRef.current === 'connecting') {
          setFailure('실시간 대화 서버에 연결하지 못했습니다.');
          setState('error');
          teardown();
        }
      };

      ws.onclose = (e) => {
        if (stateRef.current === 'live') {
          toast({ title: '연결이 끊어졌습니다', description: '지금까지의 대화로 채점을 진행합니다.' });
          finish();
        } else if (stateRef.current === 'connecting') {
          setFailure(`연결이 거부되었습니다 (${e.code}). ${e.reason || ''}`.trim());
          setState('error');
          teardown();
        }
      };

      // 마이크를 PCM 으로 바꿔 계속 보냅니다.
      const source = micCtx.createMediaStreamSource(mic);
      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const pcm = toPcm16(e.inputBuffer.getChannelData(0));
        ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{ mimeType: `audio/pcm;rate=${INPUT_RATE}`, data: toBase64(pcm) }],
          },
        }));
      };
      source.connect(processor);
      // 일부 브라우저는 목적지에 연결하지 않으면 처리 자체를 멈춥니다.
      // 소리가 새어 나가지 않도록 음량 0 으로 연결합니다.
      const mute = micCtx.createGain();
      mute.gain.value = 0;
      processor.connect(mute);
      mute.connect(micCtx.destination);
    } catch (e: any) {
      console.error('[Gemini Live 평가] 연결 실패:', e);
      teardown();
      setFailure(e?.message || '연결에 실패했습니다.');
      setState('error');
    }
  };

  const spokenChars = turns.filter((t) => t.role === 'user').reduce((n, t) => n + t.text.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <ScrollArea className="h-80 w-full rounded-md border p-4" ref={scrollRef}>
          <div className="space-y-4">
            {state === 'idle' && turns.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground pt-12">
                <Rss className="h-12 w-12 mb-4 text-primary" />
                <p className="font-semibold">AI와 실시간으로 대화하며 평가를 받습니다.</p>
                <p className="text-sm mt-1">버튼을 눌러 말하지 않아도 됩니다. 그냥 말하면 AI가 대답합니다.</p>
                {limitSeconds > 0 && (
                  <p className="text-sm mt-1">제한 시간 {assessment.recordingTimeLimit}분이 지나면 자동으로 끝납니다.</p>
                )}
              </div>
            )}

            {state === 'connecting' && (
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground pt-12">
                <Loader2 className="h-12 w-12 mb-4 animate-spin" />
                <p className="font-semibold">AI와 연결하는 중입니다…</p>
                <p className="text-sm">마이크 사용을 허용해 주세요.</p>
              </div>
            )}

            {state === 'ending' && (
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground pt-12">
                <Loader2 className="h-12 w-12 mb-4 animate-spin" />
                <p className="font-semibold">대화를 저장하고 채점으로 넘기는 중입니다…</p>
              </div>
            )}

            {state === 'error' && failure && (
              <div className="flex flex-col items-center justify-center text-center pt-12">
                <AlertCircle className="h-12 w-12 mb-4 text-destructive" />
                <p className="font-semibold text-destructive">{failure}</p>
                <p className="text-sm text-muted-foreground mt-1">아래 버튼으로 다시 시작할 수 있습니다.</p>
              </div>
            )}

            {turns.map((turn, i) => (
              <div key={i} className={cn('flex items-start gap-3', turn.role === 'user' ? 'justify-start' : 'justify-end')}>
                {turn.role === 'user' && <div className="p-2 rounded-full bg-muted"><User className="h-5 w-5" /></div>}
                <div className={cn('p-3 rounded-lg max-w-[80%]', turn.role === 'user' ? 'bg-muted' : 'bg-primary text-primary-foreground')}>
                  <p className="text-sm">{turn.text}</p>
                </div>
                {turn.role === 'model' && <div className="p-2 rounded-full bg-primary text-primary-foreground"><Bot className="h-5 w-5" /></div>}
              </div>
            ))}
          </div>
        </ScrollArea>

        {state === 'live' && (
          <div className="absolute top-2 right-2 flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-xs font-medium shadow">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            대화 중 · {mmss(elapsed)}
            {limitSeconds > 0 && ` / ${mmss(limitSeconds)}`}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-grow">
            {state === 'live' ? (
              <Button size="lg" variant="destructive" className="w-full" onClick={finish}>
                <Square className="mr-2 h-5 w-5" />대화 종료하고 제출
              </Button>
            ) : state === 'connecting' || state === 'ending' ? (
              <Button size="lg" disabled className="w-full">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {state === 'connecting' ? '연결 중…' : '제출 중…'}
              </Button>
            ) : (
              <Button size="lg" className="w-full" onClick={start}>
                {state === 'error' ? <Mic className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
                {state === 'error' ? '다시 연결' : '대화 시작'}
              </Button>
            )}
          </div>

          <Button
            variant="secondary"
            onClick={() => { teardown(); router.push('/student/dashboard'); }}
            disabled={state === 'connecting' || state === 'ending'}
          >
            <CornerDownLeft className="mr-2 h-5 w-5" />나가기
          </Button>
        </div>

        {state === 'live' && (
          <p className="text-base text-center text-muted-foreground">
            그냥 말하면 됩니다. 말을 멈추면 AI가 대답합니다.
            {spokenChars < MIN_STUDENT_CHARS && ' 채점할 수 있을 만큼 충분히 말해 주세요.'}
          </p>
        )}
      </div>
    </div>
  );
}
