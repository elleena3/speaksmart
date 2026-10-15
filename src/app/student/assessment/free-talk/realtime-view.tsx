"use client"

/**
 * 실시간 대화(OpenAI Realtime) 평가 응시 화면.
 *
 * 턴 방식(free-talk-view)과 다른 점은 '어떻게 대화하는가' 하나뿐입니다.
 * - 턴 방식: [응답하기] → 말하고 → [말하기 중지] → 서버가 전사·답변·음성합성을
 *            차례로 돌려 약 10초 뒤 답이 나옵니다.
 * - 여기:    WebRTC 로 음성을 바로 주고받습니다. 0.5초 침묵하면 자동으로 턴이
 *            넘어가고 끼어들기도 됩니다. 버튼은 시작·종료 두 번만 누릅니다.
 *
 * 채점은 두 방식이 완전히 같습니다. 끝나면 똑같이 sessionStorage 에 넘겨
 * processing 화면이 대화 분석 플로우를 돌립니다. 그래서 결과·루브릭·성장 추이는
 * 손대지 않았습니다.
 *
 * 연결 절차는 교사용 도구(openai-realtime-conversation-tool)에서 검증된 것을
 * 그대로 씁니다. GA 세션 형식, 영어 고정 전사, 에코 제거가 모두 거기서 잡힌
 * 내용이라 다시 쓰지 않고 같은 순서를 유지합니다.
 */

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Mic, Square, Loader2, Play, User, Bot, Rss, CornerDownLeft, AlertCircle } from "lucide-react"
import { getOpenAiLiveSessionToken } from "@/ai/flows/get-openai-live-session-token"
import { REALTIME_INSTRUCTIONS } from "@/lib/realtime-config"
import { CONVERSATION_MIC_CONSTRAINTS } from "@/lib/mic-constraints"
import { startStudentMicRecorder, type StudentMicRecorder } from "@/lib/student-mic-recorder"
import { uploadConversationRecording } from "@/lib/upload-recording"
import { defaultRealtimeModel, defaultRealtimeVoice, type TeacherAssessment } from "@/lib/types"
import { type ConversationTurn } from "@/lib/types/ai-schemas"
import { cn } from "@/lib/utils"

const SESSION_STORAGE_KEY = 'freeTalkSessionData';

/** 분석할 만한 최소 발화량. 이보다 짧으면 제출해도 점수가 0으로 나옵니다. */
const MIN_STUDENT_CHARS = 20;

type ViewState = 'idle' | 'connecting' | 'live' | 'ending' | 'error';

/**
 * 평가 지시문. 교사가 적은 주제·지문을 실시간 대화 지침에 얹습니다.
 * 이게 없으면 학생마다 전혀 다른 주제로 흘러가 같은 기준으로 채점할 수 없습니다.
 */
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

export function RealtimeAssessmentView({ assessment }: { assessment: TeacherAssessment }) {
  const router = useRouter();
  const { toast } = useToast();

  const [state, setState] = useState<ViewState>('idle');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);

  // 이벤트 핸들러는 연결 시점의 값을 잡아두므로 최신 값은 ref 로 읽습니다.
  const stateRef = useRef<ViewState>('idle');
  const turnsRef = useRef<ConversationTurn[]>([]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { turnsRef.current = turns; }, [turns]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const studentMicRef = useRef<StudentMicRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // 종료가 두 번 돌면 녹음이 중복 업로드됩니다.
  const endingRef = useRef(false);

  const limitSeconds = assessment.recordingTimeLimit ? assessment.recordingTimeLimit * 60 : 0;

  /** 연결·오디오·녹음을 모두 정리합니다. 실패 경로에서도 반드시 불립니다. */
  const teardown = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    pcRef.current?.close();
    pcRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.remove();
      remoteAudioRef.current = null;
    }
    // AudioContext 는 마이크 녹음을 들고 있어 녹음을 먼저 멈춘 뒤 닫습니다.
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  useEffect(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return () => { studentMicRef.current = null; teardown(); };
  }, [teardown]);

  useEffect(() => {
    const el = scrollRef.current?.querySelector('div');
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  /**
   * 대화를 끝내고 채점으로 넘깁니다.
   *
   * 실패하더라도 화면을 멈춰 두지 않습니다. 이전 턴 방식 화면에서 저장이 실패하면
   * '제출 중…' 에서 버튼이 모두 비활성인 채 영구 정지하는 문제가 있었습니다.
   */
  const finish = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setState('ending');
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    // AudioContext 를 닫으면 녹음도 끊기므로 정지 요청을 먼저 걸어 둡니다.
    const blobPromise = studentMicRef.current?.stopAndGetBlob() ?? Promise.resolve(null);
    studentMicRef.current = null;
    teardown();

    try {
      const studentBlob = await blobPromise;
      const spoken = turnsRef.current
        .filter((t) => t.role === 'user')
        .map((t) => t.text)
        .join(' ')
        .trim();

      if (!studentBlob || spoken.length < MIN_STUDENT_CHARS) {
        setFailure('말한 내용이 너무 짧아 채점할 수 없습니다. 다시 연결해 조금 더 길게 대화해 주세요.');
        setState('error');
        endingRef.current = false;
        return;
      }

      // 녹음은 Storage 로 바로 올립니다. data URI 로 바꿔 sessionStorage 에 담으면
      // 몇 분 분량만으로도 용량(약 5MB)을 넘겨 제출이 실패합니다.
      const recordingUrl = await uploadConversationRecording(studentBlob, 'assessment-realtime');

      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        studentRecordingDataUri: recordingUrl,
        conversationHistory: turnsRef.current,
        assessment,
      }));

      router.push(`/student/assessment/free-talk/processing?id=${assessment.id}`);
    } catch (e: any) {
      console.error('[실시간 평가] 제출 실패:', e);
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

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      const token = await getOpenAiLiveSessionToken({
        model: assessment.realtimeModel || defaultRealtimeModel,
        voice: (assessment.realtimeVoice || defaultRealtimeVoice) as any,
      });

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if ((s === 'disconnected' || s === 'failed' || s === 'closed') && stateRef.current === 'live') {
          // 통화가 끊겼으면 여기까지의 대화로 채점을 넘깁니다. 버리지 않습니다.
          toast({ title: '연결이 끊어졌습니다', description: '지금까지의 대화로 채점을 진행합니다.' });
          finish();
        }
      };

      // Chrome 은 원격 스트림을 <audio> 에 붙이지 않으면 소리를 내보내지 않습니다.
      const remoteAudio = document.createElement('audio');
      remoteAudio.autoplay = true;
      remoteAudio.style.display = 'none';
      document.body.appendChild(remoteAudio);
      remoteAudioRef.current = remoteAudio;

      pc.ontrack = (e) => {
        remoteAudio.srcObject = e.streams[0];
        remoteAudio.play().catch((err) => {
          console.error('AI 음성 재생 실패:', err);
          toast({
            title: '소리가 재생되지 않습니다',
            description: '브라우저가 자동 재생을 막았습니다. 화면을 한 번 누른 뒤 다시 시작해 주세요.',
            variant: 'destructive',
          });
        });
      };

      // 에코 제거를 명시해야 스피커로 나온 AI 목소리가 학생 발화로 전사되지 않습니다.
      const mic = await navigator.mediaDevices.getUserMedia({ audio: CONVERSATION_MIC_CONSTRAINTS });
      micStreamRef.current = mic;
      pc.addTrack(mic.getTracks()[0]);

      // 발음 채점은 학생 목소리만 들어야 하므로 마이크만 따로 담습니다.
      const micNode = audioCtx.createMediaStreamSource(mic);
      studentMicRef.current = startStudentMicRecorder(audioCtx, micNode);

      const dc = pc.createDataChannel('oai-events');
      let greeted = false;
      const greet = () => {
        if (greeted || dc.readyState !== 'open') return;
        greeted = true;
        dc.send(JSON.stringify({
          type: 'response.create',
          response: { instructions: 'Greet the student briefly and ask your first question about the topic.' },
        }));
      };

      dc.addEventListener('open', () => {
        // GA 형식입니다. 예전(베타) 형식으로 보내면 설정이 통째로 무시됩니다.
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            type: 'realtime',
            output_modalities: ['audio'],
            instructions: buildInstructions(assessment),
            audio: {
              input: {
                // 언어를 고정해야 짧은 영어 발화를 다른 언어로 잘못 알아듣지 않습니다.
                transcription: { model: 'gpt-4o-mini-transcribe', language: 'en' },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500,
                },
              },
              output: { voice: assessment.realtimeVoice || defaultRealtimeVoice },
            },
          },
        }));
        // session.updated 가 오지 않아도 대화가 시작되도록 하는 보험입니다.
        setTimeout(greet, 2000);
      });

      dc.addEventListener('message', (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === 'session.updated') greet();
          if (event.type === 'error') {
            console.error('OpenAI Realtime 오류:', event.error);
          }
          if (event.type === 'conversation.item.input_audio_transcription.completed') {
            setTurns((prev) => [...prev, { role: 'user', text: event.transcript }]);
          }
          if (event.type === 'response.output_audio_transcript.done' || event.type === 'response.audio_transcript.done') {
            setTurns((prev) => [...prev, { role: 'model', text: event.transcript }]);
          }
        } catch (err) {
          console.error('데이터 채널 파싱 실패:', err);
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime/calls?model=${assessment.realtimeModel || defaultRealtimeModel}`,
        {
          method: 'POST',
          body: offer.sdp,
          headers: { Authorization: `Bearer ${token.value}`, 'Content-Type': 'application/sdp' },
        }
      );
      if (!sdpRes.ok) {
        const detail = await sdpRes.text().catch(() => '');
        throw new Error(`연결 실패 (${sdpRes.status}): ${detail.slice(0, 200) || sdpRes.statusText}`);
      }
      await pc.setRemoteDescription({ type: 'answer' as RTCSdpType, sdp: await sdpRes.text() });

      setState('live');
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          // 제한 시간이 있으면 알아서 끝냅니다. 실시간 통화는 켜 둔 만큼 비용이 듭니다.
          if (limitSeconds && next >= limitSeconds) finish();
          return next;
        });
      }, 1000);
    } catch (e: any) {
      console.error('[실시간 평가] 연결 실패:', e);
      studentMicRef.current = null;
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
                <p className="text-sm mt-1">
                  버튼을 눌러 말하지 않아도 됩니다. 말을 멈추면 AI가 바로 대답합니다.
                </p>
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
                {turn.role === 'user' && (
                  <div className="p-2 rounded-full bg-muted"><User className="h-5 w-5" /></div>
                )}
                <div className={cn('p-3 rounded-lg max-w-[80%]', turn.role === 'user' ? 'bg-muted' : 'bg-primary text-primary-foreground')}>
                  <p className="text-sm">{turn.text}</p>
                </div>
                {turn.role === 'model' && (
                  <div className="p-2 rounded-full bg-primary text-primary-foreground"><Bot className="h-5 w-5" /></div>
                )}
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

          {/* 연결 중·제출 중에만 막습니다. 오류가 나도 나갈 길은 남겨 둡니다. */}
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
