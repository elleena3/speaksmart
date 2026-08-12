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
import {
  Mic, Headphones, Volume2, Hand, Play, Square, RotateCcw, Sparkles, Loader2,
  ChevronLeft, ChevronRight, Trash2, Pencil,
} from 'lucide-react';

const MIME_TYPE = 'audio/webm;codecs=opus';

type Mode = 'voice' | 'shadowing' | 'listen' | 'manual';

const MODES: { id: Mode; label: string; hint: string; icon: typeof Mic }[] = [
  { id: 'voice', label: '음성 인식 따라읽기', hint: '학생이 읽으면 마이크가 알아듣고 위치를 옮깁니다', icon: Mic },
  { id: 'shadowing', label: '쉐도잉 (원어민 + 동시 따라읽기)', hint: '원어민 음성을 들으며 동시에 말하고 녹음합니다', icon: Headphones },
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
  const activeWordRef = useRef<HTMLSpanElement | null>(null);

  const words = useMemo(() => passage.trim().split(/\s+/).filter(Boolean), [passage]);
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
  const followSpokenWords = useCallback((spoken: string) => {
    const tokens = spoken.split(/\s+/).map(normalise).filter(Boolean);
    if (!tokens.length) return;

    const from = Math.max(0, wordIndexRef.current);
    const to = Math.min(normalisedWords.length, from + 20);
    for (let i = to - 1; i >= from; i--) {
      if (normalisedWords[i] && tokens.includes(normalisedWords[i])) {
        moveTo(i);
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
        if (modeRef.current !== 'listen') followSpokenWords(finalText);
      } else if (pending.trim()) {
        setInterim(pending.trim());
        if (modeRef.current === 'voice') followSpokenWords(pending);
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
      if (event.name === 'word') moveTo(Math.min(cursor++, words.length - 1));
    };
    utterance.onend = () => { if (runningRef.current) stopAll(); };

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
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blobRef.current!);
      });

      const output = await analyzeShadowing({
        audioDataUri: dataUri,
        passage,
        liveTranscript: lines.join(' ') || undefined,
        mode: mode === 'shadowing' ? 'shadowing' : 'reading',
        playbackRate: rate,
      });
      setResult(output);
    } catch (e) {
      toast({
        title: '분석 실패',
        description: e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  }, [passage, lines, mode, rate, toast]);

  const reset = useCallback(() => {
    stopAll();
    moveTo(-1);
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

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>진행률</span>
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
            <CardDescription className="text-xs">단어를 누르면 그 위치부터 시작합니다.</CardDescription>
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
                  i > wordIndex && 'hover:bg-muted'
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
