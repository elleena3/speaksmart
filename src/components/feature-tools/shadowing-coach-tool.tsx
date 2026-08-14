"use client";

/**
 * 쉐도잉 코치 — 원어민 음성을 들으며 동시에 따라 읽고 AI 평가를 받는 도구.
 *
 * Read Aloud 도구는 '혼자 읽고 채점'까지지만, 여기서는 읽는 동안 지문 위 위치를
 * 따라가며 표시하고, 말한 내용을 자막으로 쌓고, 녹음본으로 억양·동기화까지 평가합니다.
 *
 * 몇 가지 설계 선택:
 * - 원어민 음성은 브라우저 speechSynthesis 를 씁니다. 서버 TTS(Gemini)는 음질이 낫지만
 *   단어 경계 시각을 주지 않아 단어 단위 하이라이트를 맞출 수 없습니다.
 * - 채점은 서버 액션으로 보냅니다. 브라우저에서 모델 API 를 직접 부르면 키가 노출됩니다.
 * - 상태가 많아 보이지만 재생·인식·녹음은 서로 독립적으로 멈출 수 있어야 해서
 *   ref 로 각각 들고 stopAll() 한 곳에서 정리합니다.
 */

import { useState, useRef, useEffect, useCallback, useMemo, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { sampleTexts } from '@/lib/book';
import { analyzeShadowing, type AnalyzeShadowingOutput } from '@/ai/flows/analyze-shadowing-flow';
import { RecordedAudio } from './recorded-audio';
import { prepareMediaInput } from '@/lib/upload-tool-file';
import { saveActivityRecord, loadActivityRecords, type ActivityRecord } from '@/lib/activity-records';
import { splitSentences } from '@/lib/split-sentences';
import {
  Mic, Headphones, Volume2, Hand, Play, Square, RotateCcw, Sparkles, Loader2,
  ChevronLeft, ChevronRight, Trash2, Pencil,
} from 'lucide-react';

const MIME_TYPE = 'audio/webm;codecs=opus';

/**
 * 원어민 음성이 끝난 뒤에도 잠시 더 녹음합니다.
 * 쉐도잉은 그림자처럼 0.1~0.5초 뒤를 따라가지만, 마지막 단어는 원어민이 끝난 뒤에
 * 마무리됩니다. 여기서 바로 멈추면 그 부분이 잘립니다.
 */
const SHADOW_TAIL_MS = 3000;

type Mode = 'voice' | 'shadowing' | 'listen' | 'manual';

const MODES: { id: Mode; label: string; hint: string; icon: typeof Mic }[] = [
  { id: 'voice', label: '음성 인식 따라읽기', hint: '학생이 읽으면 마이크가 알아듣고 위치를 옮깁니다', icon: Mic },
  { id: 'shadowing', label: '쉐도잉 (그림자처럼 바로 뒤따라 말하기)', hint: '원어민 소리를 들으며 거의 동시에, 반 박자 뒤에서 겹쳐 말합니다', icon: Headphones },
  { id: 'listen', label: '원어민 듣기', hint: '재생에 맞춰 단어가 순서대로 표시됩니다', icon: Volume2 },
  { id: 'manual', label: '수동 / 포인터', hint: '마우스 올리기, 버튼, 방향키로 직접 옮깁니다', icon: Hand },
];

/** 비교용으로 문장부호와 대소문자를 지웁니다. */
const normalise = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '');



export function ShadowingCoachTool() {
  const { toast } = useToast();
  const textareaId = useId();

  const [passage, setPassage] = useState(sampleTexts.beginner.text.split('\n')[0] ?? sampleTexts.beginner.text);
  const [draft, setDraft] = useState(passage);
  const [editing, setEditing] = useState(false);

  const [mode, setMode] = useState<Mode>('shadowing');
  const [running, setRunning] = useState(false);
  const [wordIndex, setWordIndex] = useState(-1);
  // 쉐도잉에서는 원어민과 학습자의 위치가 다릅니다.
  // wordIndex 는 원어민이 읽는 자리, learnerIndex 는 학습자가 따라온 자리입니다.
  const [learnerIndex, setLearnerIndex] = useState(-1);
  const [finishing, setFinishing] = useState(false);
  const [rate, setRate] = useState(1);

  const [lines, setLines] = useState<string[]>([]);
  const [interim, setInterim] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeShadowingOutput | null>(null);

  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const pacerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);
  const modeRef = useRef<Mode>(mode);
  const wordIndexRef = useRef(-1);
  const learnerIndexRef = useRef(-1);
  // 원어민이 각 단어를 읽은 시각과, 학습자가 그 단어에 도달한 시각.
  // 둘을 맞대면 실제 지연을 잴 수 있습니다. AI 는 학습자 음성만 받으므로
  // 이 값을 넘겨 주지 않으면 간격을 추정할 수밖에 없습니다.
  const nativeAtRef = useRef<Map<number, number>>(new Map());
  const learnerAtRef = useRef<Map<number, number>>(new Map());
  const [measuredLagMs, setMeasuredLagMs] = useState<number | null>(null);
  /** 'sentence' 면 고른 문장만, 'whole' 이면 지문 전체를 연습합니다. */
  const [scope, setScope] = useState<'sentence' | 'whole'>('sentence');
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [history, setHistory] = useState<ActivityRecord[]>([]);
  const tailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeWordRef = useRef<HTMLSpanElement | null>(null);

  const sentences = useMemo(() => splitSentences(passage), [passage]);
  const currentSentence = sentences[Math.min(sentenceIndex, sentences.length - 1)] ?? passage;
  /** 실제로 읽고 채점할 대상. 문장 모드면 그 문장만입니다. */
  const target = scope === 'sentence' ? currentSentence : passage;

  const words = useMemo(() => target.trim().split(/\s+/).filter(Boolean), [target]);
  const normalisedWords = useMemo(() => words.map(normalise), [words]);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { wordIndexRef.current = wordIndex; }, [wordIndex]);

  const speechSupported = typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const moveTo = useCallback((index: number) => {
    if (index < -1 || index >= words.length) return;
    setWordIndex(index);
    wordIndexRef.current = index;
  }, [words.length]);

  // 활성 단어가 보이도록 스크롤. 지문이 길 때 필요합니다.
  useEffect(() => {
    activeWordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [wordIndex]);

  /**
   * 들린 말을 지문에서 찾아 위치를 옮깁니다.
   * 현재 위치부터 앞으로만, 좁은 구간에서만 찾습니다.
   * 지문 전체에서 찾으면 흔한 단어(the, a) 때문에 엉뚱한 곳으로 튑니다.
   */
  const followSpokenWords = useCallback((spoken: string, target: 'native' | 'learner') => {
    const tokens = spoken.split(/\s+/).map(normalise).filter(Boolean);
    if (!tokens.length) return;

    const cursor = target === 'learner' ? learnerIndexRef.current : wordIndexRef.current;
    const from = Math.max(0, cursor);
    const to = Math.min(normalisedWords.length, from + 20);
    for (let i = to - 1; i >= from; i--) {
      if (normalisedWords[i] && tokens.includes(normalisedWords[i])) {
        if (target === 'learner') {
          setLearnerIndex(i);
          learnerIndexRef.current = i;
          if (!learnerAtRef.current.has(i)) {
            learnerAtRef.current.set(i, Date.now());
            const spokenAt = nativeAtRef.current.get(i);
            if (spokenAt) setMeasuredLagMs(Date.now() - spokenAt);
          }
        }
        else moveTo(i);
        return;
      }
    }
  }, [normalisedWords, moveTo]);

  const stopAll = useCallback(() => {
    runningRef.current = false;
    setRunning(false);

    try { recognitionRef.current?.stop(); } catch { /* 이미 멈춘 경우 */ }
    window.speechSynthesis?.cancel();

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      recorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    if (pacerRef.current) { clearInterval(pacerRef.current); pacerRef.current = null; }
    if (tailTimerRef.current) { clearTimeout(tailTimerRef.current); tailTimerRef.current = null; }
    setFinishing(false);
  }, []);

  useEffect(() => stopAll, [stopAll]);

  const startRecognition = useCallback(() => {
    const Impl = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Impl) return false;

    const recognition = new Impl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalText = '';
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += text + ' ';
        else pending += text;
      }
      if (finalText.trim()) {
        setLines((prev) => [...prev, finalText.trim()]);
        setInterim('');
        // 쉐도잉에서는 노란 표시가 원어민을 따라가야 합니다.
        // 여기서 학습자 위치로 되돌리면 표시가 앞뒤로 튑니다.
        if (modeRef.current === 'shadowing') followSpokenWords(finalText, 'learner');
        else if (modeRef.current !== 'listen') followSpokenWords(finalText, 'native');
      } else if (pending.trim()) {
        setInterim(pending.trim());
        if (modeRef.current === 'voice') followSpokenWords(pending, 'native');
        else if (modeRef.current === 'shadowing') followSpokenWords(pending, 'learner');
      }
    };
    // 브라우저가 조용하면 스스로 끊습니다. 진행 중이면 다시 붙입니다.
    recognition.onend = () => {
      if (runningRef.current) { try { recognition.start(); } catch { /* 재시작 실패는 무시 */ } }
    };
    recognition.onerror = () => { /* no-speech 등은 무시하고 계속 */ };

    recognitionRef.current = recognition;
    try { recognition.start(); return true; } catch { return false; }
  }, [followSpokenWords]);

  const startRecording = useCallback(async () => {
    chunksRef.current = [];
    blobRef.current = null;
    setAudioUrl(null);
    setResult(null);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: MIME_TYPE });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: MIME_TYPE });
      blobRef.current = blob;
      setAudioUrl(URL.createObjectURL(blob));
    };
    // 1초마다 조각을 받아 둡니다. 중간에 비정상 종료돼도 그때까지 녹음이 남습니다.
    recorder.start(1000);
    recorderRef.current = recorder;
  }, []);

  /** 원어민 음성 재생. 단어 경계마다 위치를 옮깁니다. */
  const speakFrom = useCallback((startIndex: number) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      toast({ title: '이 브라우저는 음성 재생을 지원하지 않습니다', variant: 'destructive' });
      return;
    }
    synth.cancel();

    const from = Math.max(0, startIndex);
    const utterance = new SpeechSynthesisUtterance(words.slice(from).join(' '));
    utterance.lang = 'en-US';
    utterance.rate = rate;

    let cursor = from;
    utterance.onboundary = (event) => {
      if (event.name !== 'word') return;
      const at = Math.min(cursor++, words.length - 1);
      if (!nativeAtRef.current.has(at)) nativeAtRef.current.set(at, Date.now());
      moveTo(at);
    };
    utterance.onend = () => {
      if (!runningRef.current) return;
      if (modeRef.current !== 'shadowing') { stopAll(); return; }
      // 학습자가 뒤따라오는 중이므로 잠시 더 녹음합니다.
      setFinishing(true);
      tailTimerRef.current = setTimeout(() => stopAll(), SHADOW_TAIL_MS);
    };

    synth.speak(utterance);
  }, [words, rate, moveTo, stopAll, toast]);

  const start = useCallback(async () => {
    if (!words.length) {
      toast({ title: '지문을 먼저 입력해주세요', variant: 'destructive' });
      return;
    }

    runningRef.current = true;
    setRunning(true);
    setResult(null);
    nativeAtRef.current.clear();
    learnerAtRef.current.clear();
    setMeasuredLagMs(null);

    try {
      if (mode === 'voice' || mode === 'shadowing') {
        await startRecording();
        if (!startRecognition() && mode === 'voice') {
          toast({
            title: '음성 인식을 쓸 수 없습니다',
            description: 'Chrome 에서 열면 자동 추적이 됩니다. 녹음과 AI 평가는 그대로 동작합니다.',
          });
        }
      }
      if (mode === 'shadowing' || mode === 'listen') {
        speakFrom(wordIndexRef.current >= 0 ? wordIndexRef.current : 0);
      }
      if (mode === 'manual') {
        // 일정 간격으로 다음 단어를 짚어 주는 페이서.
        pacerRef.current = setInterval(() => {
          const next = wordIndexRef.current + 1;
          if (next >= words.length) stopAll();
          else moveTo(next);
        }, Math.round(480 / rate));
      }
    } catch {
      runningRef.current = false;
      setRunning(false);
      toast({ title: '마이크 접근 오류', description: '브라우저에서 마이크 권한을 허용해주세요.', variant: 'destructive' });
    }
  }, [mode, words.length, rate, startRecording, startRecognition, speakFrom, stopAll, moveTo, toast]);

  const analyze = useCallback(async () => {
    if (!blobRef.current) {
      toast({ title: '녹음이 없습니다', description: '음성 인식 또는 쉐도잉으로 먼저 읽어주세요.', variant: 'destructive' });
      return;
    }
    setAnalyzing(true);
    try {
      // 긴 녹음은 요청 본문 한도를 넘으므로 Storage 를 거칩니다.
      const dataUri = await prepareMediaInput(blobRef.current, 'shadowing', 'shadowing.webm');

      // 단어마다 잰 지연의 중앙값. 한두 번 크게 튄 값에 휘둘리지 않습니다.
      const lags: number[] = [];
      learnerAtRef.current.forEach((at, index) => {
        const spokenAt = nativeAtRef.current.get(index);
        if (spokenAt) lags.push(at - spokenAt);
      });
      lags.sort((a, b) => a - b);
      const medianLagMs = lags.length ? lags[Math.floor(lags.length / 2)] : undefined;

      const output = await analyzeShadowing({
        audioDataUri: dataUri,
        passage: target,
        liveTranscript: lines.join(' ') || undefined,
        mode: mode === 'shadowing' ? 'shadowing' : 'reading',
        playbackRate: rate,
        measuredLagMs: medianLagMs,
        measuredWordCount: lags.length || undefined,
      });
      setResult(output);

      // 같은 문장을 반복하며 점수가 오르는 것을 보려면 시도를 남겨야 합니다.
      try {
        await saveActivityRecord({
          type: 'shadowing',
          title: target,
          score: output.overallScore,
          detail: {
            pronunciation: output.pronunciationScore,
            intonation: output.intonationScore,
            sync: output.syncScore,
            completion: output.completionRate,
            lagMs: medianLagMs ?? null,
          },
        });
        setHistory(await loadActivityRecords({ type: 'shadowing', subject: target }));
      } catch {
        // 기록을 못 남겨도 연습과 평가는 그대로 쓸 수 있어야 합니다.
      }
    } catch (e) {
      toast({
        title: '분석 실패',
        description: e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  }, [target, lines, mode, rate, toast]);

  const reset = useCallback(() => {
    stopAll();
    moveTo(-1);
    setLearnerIndex(-1);
    learnerIndexRef.current = -1;
    nativeAtRef.current.clear();
    learnerAtRef.current.clear();
    setMeasuredLagMs(null);
    setLines([]);
    setInterim('');
    setAudioUrl(null);
    blobRef.current = null;
    setResult(null);
  }, [stopAll, moveTo]);

  // 방향키로도 옮길 수 있게 합니다. 입력 중일 때는 방해하지 않습니다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode !== 'manual' && mode !== 'voice') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); moveTo(Math.min(wordIndexRef.current + 1, words.length - 1)); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); moveTo(Math.max(wordIndexRef.current - 1, 0)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, words.length, moveTo]);

  /** 문장을 옮기면 이전 문장의 표시와 결과가 남지 않도록 정리합니다. */
  const goToSentence = useCallback((index: number) => {
    if (index < 0 || index >= sentences.length) return;
    stopAll();
    setSentenceIndex(index);
    moveTo(-1);
    setLearnerIndex(-1);
    learnerIndexRef.current = -1;
    setMeasuredLagMs(null);
    setResult(null);
    setLines([]);
    setInterim('');
  }, [sentences.length, stopAll, moveTo]);

  // 고른 문장의 지난 기록을 불러옵니다.
  useEffect(() => {
    let alive = true;
    loadActivityRecords({ type: 'shadowing', subject: target })
      .then((rows) => { if (alive) setHistory(rows); }).catch(() => {});
    return () => { alive = false; };
  }, [target]);

  const progress = words.length ? Math.round(((wordIndex + 1) / words.length) * 100) : 0;
  const canAnalyze = !!audioUrl && !analyzing;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 모드 선택 */}
        <Card className="lg:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">연습 방식</CardTitle>
            <CardDescription className="text-xs">방식마다 마이크·원어민 음성 사용이 다릅니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {MODES.map(({ id, label, hint, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => { stopAll(); setMode(id); }}
                className={cn(
                  'w-full text-left p-2.5 rounded-lg border flex items-start gap-3 transition',
                  mode === id ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'hover:border-primary/40'
                )}
              >
                <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', mode === id ? 'text-primary' : 'text-muted-foreground')} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
              </button>
            ))}
            {!speechSupported && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                이 브라우저는 음성 인식을 지원하지 않습니다. 자동 위치 추적은 안 되지만
                녹음과 AI 평가는 그대로 됩니다. (Chrome 권장)
              </p>
            )}
          </CardContent>
        </Card>

        {/* 조작 */}
        <Card className="lg:col-span-7">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">진행</CardTitle>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              읽기 속도
              <input
                type="range" min={0.5} max={1.5} step={0.1} value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-24 accent-primary cursor-pointer"
              />
              <span className="font-medium tabular-nums w-8">{rate.toFixed(1)}x</span>
            </label>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="inline-flex rounded-md border overflow-hidden">
                <button type="button" onClick={() => { stopAll(); setScope('sentence'); }}
                  className={cn('px-2.5 py-1', scope === 'sentence' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                  문장별
                </button>
                <button type="button" onClick={() => { stopAll(); setScope('whole'); }}
                  className={cn('px-2.5 py-1 border-l', scope === 'whole' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                  지문 전체
                </button>
              </div>

              {scope === 'sentence' && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7"
                    onClick={() => goToSentence(sentenceIndex - 1)} disabled={sentenceIndex === 0} aria-label="이전 문장">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="tabular-nums text-muted-foreground">
                    {Math.min(sentenceIndex + 1, sentences.length)} / {sentences.length} 문장
                  </span>
                  <Button variant="outline" size="icon" className="h-7 w-7"
                    onClick={() => goToSentence(sentenceIndex + 1)} disabled={sentenceIndex >= sentences.length - 1} aria-label="다음 문장">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {history.length > 0 && (
                <span className="text-muted-foreground">
                  이 {scope === 'sentence' ? '문장' : '지문'} {history.length}번 연습 ·
                  최고 <b className="text-foreground">{Math.max(...history.map((h) => h.score))}점</b>
                  {history[0] && ` · 직전 ${history[0].score}점`}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {running ? (
                <Button onClick={stopAll} variant="destructive" className="flex-1 min-w-[140px]">
                  <Square className="mr-2 h-4 w-4" />중지
                </Button>
              ) : (
                <Button onClick={start} className="flex-1 min-w-[140px]">
                  {mode === 'listen' ? <Play className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                  {mode === 'shadowing' ? '쉐도잉 시작' : mode === 'listen' ? '원어민 음성 재생' : mode === 'manual' ? '가이드 시작' : '읽기 시작'}
                </Button>
              )}
              {(mode === 'manual' || mode === 'voice') && (
                <>
                  <Button variant="outline" size="icon" onClick={() => moveTo(Math.max(wordIndex - 1, 0))} aria-label="이전 단어">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => moveTo(Math.min(wordIndex + 1, words.length - 1))} aria-label="다음 단어">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />초기화</Button>
              <Button variant="outline" onClick={() => { setDraft(passage); setEditing((v) => !v); }}>
                <Pencil className="mr-2 h-4 w-4" />지문
              </Button>
            </div>

            {mode === 'shadowing' && (
              <p className="text-xs text-muted-foreground">
                🎧 <b>이어폰을 쓰십시오.</b> 스피커로 들으면 원어민 목소리가 마이크에 섞여 내 발음 대신 그 소리가 채점됩니다.
                원어민 소리를 들으면서 <b>거의 동시에</b>, 반 박자(0.1~0.5초) 뒤에서 그림자처럼 겹쳐 말합니다.
                문장이 끝나기를 기다렸다가 따라 하는 것이 아닙니다.
                {measuredLagMs !== null && (
                  <span className={cn('ml-1 font-semibold',
                    measuredLagMs <= 900 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                    · 현재 간격 {(measuredLagMs / 1000).toFixed(1)}초
                    {measuredLagMs > 900 && ' (조금 더 빨리 붙어 보세요)'}
                  </span>
                )}
                {finishing && <span className="text-amber-600 dark:text-amber-400"> · 원어민은 끝났습니다. 마무리까지 녹음 중…</span>}
              </p>
            )}

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{mode === 'shadowing' ? '원어민 진행' : '진행률'}</span>
                <span className="font-medium tabular-nums">
                  {Math.max(wordIndex + 1, 0)} / {words.length} 단어 ({progress}%)
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {audioUrl && (
              <div className="flex items-center gap-2">
                <RecordedAudio src={audioUrl} className="flex-1" />
                <Button onClick={analyze} disabled={!canAnalyze} className="shrink-0">
                  {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  AI 평가
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {editing && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">지문 입력</CardTitle>
            <CardDescription className="text-xs">샘플을 고르거나 직접 붙여넣으세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                <Button key={level} variant="outline" size="sm"
                  onClick={() => setDraft(sampleTexts[level].text.split('\n')[0] ?? sampleTexts[level].text)}>
                  {level === 'beginner' ? '초급' : level === 'intermediate' ? '중급' : '고급'} · {sampleTexts[level].title}
                </Button>
              ))}
            </div>
            <Textarea id={textareaId} rows={6} value={draft} onChange={(e) => setDraft(e.target.value)}
              className="font-serif leading-relaxed" placeholder="연습할 영문 지문을 입력하세요." />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>취소</Button>
              <Button onClick={() => {
                const next = draft.trim();
                if (!next) return;
                reset();
                setPassage(next);
                setEditing(false);
              }}>적용</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 지문 */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">지문</CardTitle>
            <CardDescription className="text-xs">
              {mode === 'shadowing'
                ? '진한 표시는 원어민이 읽는 자리, 테두리 표시는 내가 따라온 자리입니다. 두 표시가 거의 붙어 있어야 잘 따라가는 것입니다.'
                : '단어를 누르면 그 위치부터 시작합니다.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[22rem] text-lg font-serif leading-relaxed">
            {words.map((word, i) => (
              <span
                key={`${word}-${i}`}
                ref={i === wordIndex ? activeWordRef : undefined}
                onClick={() => { moveTo(i); if (mode === 'listen' || mode === 'shadowing') speakFrom(i); }}
                onMouseEnter={() => { if (mode === 'manual') moveTo(i); }}
                className={cn(
                  // 단어 사이 간격은 mr 로 둡니다. 공백 노드를 끼워 넣으면
                  // 긴 지문에서 배열을 계속 다시 만들게 됩니다.
                  'inline-block rounded px-1 py-0.5 mr-1 cursor-pointer transition-colors',
                  i === wordIndex && 'bg-primary text-primary-foreground font-semibold',
                  i < wordIndex && 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
                  i > wordIndex && 'hover:bg-muted',
                  // 쉐도잉에서 내가 따라온 자리. 원어민(노란 표시)과의 간격이 곧 지연입니다.
                  mode === 'shadowing' && i === learnerIndex && i !== wordIndex &&
                    'ring-2 ring-amber-500 ring-offset-1'
                )}
              >
                {word}
              </span>
            ))}
          </CardContent>
        </Card>

        {/* 자막 */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm">내가 말한 내용</CardTitle>
              <CardDescription className="text-xs">브라우저 음성 인식 결과입니다. 정확하지 않을 수 있습니다.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setLines([]); setInterim(''); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[22rem] space-y-1.5 font-mono text-sm">
            {lines.length === 0 && !interim && (
              <p className="text-muted-foreground text-xs">읽기 시작하면 여기에 쌓입니다.</p>
            )}
            {lines.map((line, i) => (
              <p key={i} className="border-l-2 border-emerald-500 pl-2">{line}</p>
            ))}
            {interim && <p className="border-l-2 border-muted pl-2 text-muted-foreground italic">{interim}</p>}
          </CardContent>
        </Card>
      </div>

      {result && <ShadowingReport result={result} />}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

function ShadowingReport({ result }: { result: AnalyzeShadowingOutput }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI 쉐도잉 평가
          <Badge variant="secondary" className="ml-1">종합 {result.overallScore}점</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ScoreBar label="발음" value={result.pronunciationScore} />
          <ScoreBar label="억양·강세" value={result.intonationScore} />
          <ScoreBar label="속도 맞추기" value={result.syncScore} />
          <ScoreBar label="완독률" value={result.completionRate} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <section className="space-y-1">
            <h4 className="font-semibold text-xs text-muted-foreground">잘한 점</h4>
            <p className="leading-relaxed whitespace-pre-wrap">{result.strengths}</p>
          </section>
          <section className="space-y-1">
            <h4 className="font-semibold text-xs text-muted-foreground">억양과 연음</h4>
            <p className="leading-relaxed whitespace-pre-wrap">{result.intonationFeedback}</p>
          </section>
        </div>

        {result.wordIssues.length > 0 && (
          <section className="space-y-2">
            <h4 className="font-semibold text-xs text-muted-foreground">고칠 단어</h4>
            <ul className="space-y-1.5">
              {result.wordIssues.map((issue, i) => (
                <li key={`${issue.word}-${i}`} className="text-sm flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{issue.word}</span>
                  <span className="text-muted-foreground text-xs">
                    {issue.heard ? `들린 소리: "${issue.heard}"` : '건너뜀'}
                  </span>
                  <span className="text-muted-foreground">— {issue.tip}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-1">
          <h4 className="font-semibold text-xs text-muted-foreground">다음 연습</h4>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.practiceTips}</p>
        </section>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">AI가 받아 적은 내용 보기</summary>
          <p className="mt-2 font-mono leading-relaxed">{result.userTranscript}</p>
        </details>
      </CardContent>
    </Card>
  );
}
