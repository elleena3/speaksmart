
"use client"

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Target, Mic, Bot, BookOpen, Sparkles, ScanText, KeyRound, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { transcribeFile, type TranscriptionResult } from "@/ai/flows/transcribe-file";
import { analyzePronunciation, type PronunciationAnalysisResult } from "@/ai/flows/analyze-pronunciation";
import { Progress } from "@/components/ui/progress";
import { RealtimeConversationTool } from "./realtime-conversation-tool";
import { ReadAloudTool } from "./read-aloud-tool";
import { HandwritingAnalyzerTool } from "./handwriting-analyzer-tool";

// This component now handles the entire result creation and feedback display process.
export default function MiscPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === '1126') {
            setIsAuthenticated(true);
            setError('');
        } else {
            setError('비밀번호가 올바르지 않습니다.');
            setPassword('');
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Card className="w-full max-w-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <KeyRound className="h-6 w-6"/> 접근 확인
                        </CardTitle>
                        <CardDescription>
                            이 페이지에 접근하려면 비밀번호를 입력하세요.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="비밀번호"
                                autoFocus
                            />
                            {error && (
                                <div className="flex items-center text-sm font-medium text-destructive">
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    {error}
                                </div>
                            )}
                            <Button type="submit" className="w-full">
                                확인
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">기타 도구</h2>
                <p className="text-muted-foreground">AI 모델의 성능을 테스트하기 위한 간단한 도구들입니다.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileText className="h-6 w-6"/> WebM 음성-텍스트 변환 도구</CardTitle>
                        <CardDescription>
                        WebM 오디오 파일을 업로드하거나 직접 녹음하여 여러 모델의 음성-텍스트 변환(STT) 결과를 비교 테스트합니다.
                        </CardDescription>
                    </CardHeader>
                    <TranscriberTool />
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Target className="h-6 w-6"/> 영어 발음 분석 도구</CardTitle>
                        <CardDescription>
                            WebM 오디오 파일을 업로드하거나 직접 녹음하여 여러 AI 모델의 발음, 억양, 유창성에 대한 피드백과 점수를 비교해보세요.
                        </CardDescription>
                    </CardHeader>
                    <PronunciationAnalyzerTool />
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Bot className="h-6 w-6"/> AI 원어민 선생님과 대화하기</CardTitle>
                        <CardDescription>
                            실시간으로 AI와 영어 회화를 연습하고, 어떤 주제로든 질문해보세요. AI가 당신의 영어 수준에 맞춰 대화해 줄 것입니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <RealtimeConversationTool />
                    </CardContent>
                </Card>

                 <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BookOpen className="h-6 w-6"/> Read Aloud 연습 도구</CardTitle>
                        <CardDescription>
                            제공된 지문을 따라 읽고 AI에게 발음, 정확도, 유창성 피드백을 받아보세요. 직접 텍스트를 입력하여 테스트할 수도 있습니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <ReadAloudTool />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ScanText className="h-6 w-6"/> AI 자필 분석 도구</CardTitle>
                        <CardDescription>
                            학생의 자필 영어 사진을 업로드하여 AI에게 글씨체 교정 피드백을 받아보세요. 
                            <span className="block text-xs mt-1 text-blue-500">참고: 이미지 위에 직접 피드백을 오버레이하는 더 정밀한 기능은 Google Cloud Vision API를 통해 구현할 수 있습니다.</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <HandwritingAnalyzerTool />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Reusable components from the original file - no change needed for them, but they must be present.
const mimeType = 'audio/webm;codecs=opus';
type RecordingState = 'idle' | 'recording';

function AudioProcessor({
  onAnalyze,
  children,
  analyzeButtonText,
  analyzeButtonIcon: AnalyzeIcon = Sparkles,
}: {
  onAnalyze: (dataUri: string) => Promise<void>;
  children: React.ReactNode;
  analyzeButtonText: string;
  analyzeButtonIcon?: React.ElementType;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        if (selectedFile.type.startsWith('audio/webm') || selectedFile.name.endsWith('.webm')) {
            setFile(selectedFile);
        } else {
            toast({
                title: "잘못된 파일 형식",
                description: ".webm 파일만 업로드할 수 있습니다.",
                variant: "destructive",
            });
            event.target.value = ''; // Reset file input
        }
    }
  };

  const processAudioBlob = (blob: Blob) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64Audio = reader.result as string;
      await onAnalyze(base64Audio);
      setIsProcessing(false);
    };
    reader.onerror = (error) => {
      console.error("File reading error:", error);
      toast({ title: "파일 읽기 오류", description: "파일을 읽는 중 문제가 발생했습니다.", variant: "destructive" });
      setIsProcessing(false);
    };
  };

  const handleAnalyzeClick = async () => {
    if (!file) {
      toast({ title: "파일 없음", description: "먼저 webm 파일을 선택하거나 녹음해주세요.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    processAudioBlob(file);
  };

  const handleStartRecording = async () => {
    setFile(null); // Clear any selected file
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setFile(audioBlob); // Set the recorded blob as the file to be analyzed
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setRecordingState('recording');
    } catch (err) {
      console.error("Microphone access error:", err);
      toast({ title: "마이크 접근 오류", description: "마이크 권한을 허용해주세요.", variant: "destructive" });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingState('idle');
    }
  };
  
  return (
    <CardContent className="space-y-4 pt-6">
      <div className="grid gap-2">
        <label htmlFor="file-upload" className="text-sm font-medium">오디오 파일 선택 또는 녹음</label>
        <div className="flex gap-2">
            <Input id="file-upload" type="file" accept="audio/webm" onChange={handleFileChange} className="flex-grow" />
            {recordingState === 'idle' ? (
                <Button onClick={handleStartRecording} variant="outline" className="shrink-0">
                    <Mic className="mr-2 h-4 w-4" /> 녹음
                </Button>
            ) : (
                <Button onClick={handleStopRecording} variant="destructive" className="shrink-0">
                    <Loader2 className="mr-2 h-4 w-4 animate-pulse" /> 중지
                </Button>
            )}
        </div>
        {file && <p className="text-sm text-muted-foreground">선택된 파일: {file.name.startsWith('blob:') ? `녹음된 오디오 (${(file.size/1024).toFixed(1)} KB)` : file.name}</p>}
      </div>
      <Button onClick={handleAnalyzeClick} disabled={isProcessing || !file} className="w-full">
        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AnalyzeIcon className="mr-2 h-4 w-4" />}
        {isProcessing ? "처리 중..." : analyzeButtonText}
      </Button>
      <div className="space-y-4">
        {isProcessing && (
            <div className="text-center p-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                <p className="mt-2 text-sm text-muted-foreground">AI 모델들이 병렬로 처리 중입니다...</p>
            </div>
        )}
        {children}
      </div>
    </CardContent>
  );
}


function TranscriberTool() {
  const [transcripts, setTranscripts] = useState<TranscriptionResult[]>([]);
  const { toast } = useToast();

  const handleAnalyze = async (dataUri: string) => {
    setTranscripts([]);
    toast({ title: "변환 시작", description: "모델별 텍스트 변환을 시작합니다." });
    try {
      const results = await transcribeFile(dataUri);
      setTranscripts(results);
      toast({ title: "변환 완료", description: "모든 모델의 변환이 완료되었습니다." });
    } catch (error: any) {
      console.error("Transcription error:", error);
      toast({ title: "텍스트 변환 오류", description: error.message || "AI 분석 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  return (
    <AudioProcessor onAnalyze={handleAnalyze} analyzeButtonText="모델별 텍스트로 변환" analyzeButtonIcon={FileText}>
        {transcripts.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              <h3 className="text-lg font-semibold border-b pb-2">모델별 변환 결과</h3>
              {transcripts.map((result, index) => (
                <div key={index} className="grid gap-2">
                  <label htmlFor={`transcript-output-${index}`} className="text-sm font-medium font-mono">{result.model}</label>
                  <Textarea id={`transcript-output-${index}`} readOnly value={result.transcript} className="text-sm bg-muted/50" rows={3} />
                </div>
              ))}
            </div>
        )}
    </AudioProcessor>
  );
}

function PronunciationAnalyzerTool() {
  const [analysisResults, setAnalysisResults] = useState<PronunciationAnalysisResult[]>([]);
  const { toast } = useToast();

  const handleAnalyze = async (dataUri: string) => {
    setAnalysisResults([]);
    toast({ title: "분석 시작", description: "모델별 발음 분석을 병렬로 시작합니다." });
    try {
        const results = await analyzePronunciation(dataUri);
        setAnalysisResults(results);
        toast({ title: "분석 완료", description: "모든 모델의 분석이 완료되었습니다." });
    } catch (e) {
         console.error("Pronunciation analysis error:", e);
         toast({ title: "발음 분석 오류", description: (e as Error).message || "AI 분석 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  return (
    <AudioProcessor onAnalyze={handleAnalyze} analyzeButtonText="모델별 발음 분석" analyzeButtonIcon={Target}>
        {analysisResults.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
            <h3 className="text-lg font-semibold border-b pb-2">모델별 분석 결과</h3>
            {analysisResults.map((result, index) => (
                <Card key={index}>
                <CardHeader>
                    <CardTitle className="text-base font-mono">{result.model}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="w-full">
                        <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-primary">발음 점수</span>
                            <span className="text-sm font-medium text-primary">{result.pronunciationScore}%</span>
                        </div>
                        <Progress value={result.pronunciationScore} className="h-2" />
                    </div>
                    <Textarea 
                        readOnly 
                        value={result.pronunciationFeedback} 
                        rows={6}
                        className="text-sm bg-muted/50"
                    />
                </CardContent>
                </Card>
            ))}
            </div>
        )}
    </AudioProcessor>
  );
}

    