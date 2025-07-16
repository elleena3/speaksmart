
"use client";

import { useState, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mic, StopCircle, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { analyzeReadAloud, type AnalyzeReadAloudOutput } from '@/ai/flows/analyze-read-aloud-flow';
import { sampleTexts } from '@/lib/book';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type RecordingState = 'idle' | 'recording' | 'recorded' | 'analyzing';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';
const mimeType = 'audio/webm;codecs=opus';

const ScoreDisplay = ({ label, value }: { label: string; value: number }) => (
    <div>
        <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-primary">{label}</span>
            <span className="text-sm font-medium text-primary">{value}%</span>
        </div>
        <Progress value={value} className="h-2" />
    </div>
);


export function ReadAloudTool() {
    const [recordingState, setRecordingState] = useState<RecordingState>('idle');
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [selectedText, setSelectedText] = useState<string>(sampleTexts.beginner.text);
    const [analysisResult, setAnalysisResult] = useState<AnalyzeReadAloudOutput | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const { toast } = useToast();

    const cleanupRecorder = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
    }, []);

    const handleSelectText = (difficulty: Difficulty) => {
        setSelectedText(sampleTexts[difficulty].text);
        setAnalysisResult(null);
        setAudioBlob(null);
        setRecordingState('idle');
    }

    const handleStartRecording = async () => {
        if (recordingState !== 'idle') return;
        setAudioBlob(null);
        setAnalysisResult(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                if (audioChunksRef.current.length === 0) {
                    toast({ title: "녹음된 오디오 없음", description: "오디오가 감지되지 않았습니다.", variant: "destructive" });
                    setRecordingState('idle');
                    return;
                }
                const blob = new Blob(audioChunksRef.current, { type: mimeType });
                setAudioBlob(blob);
                setRecordingState('recorded');
                cleanupRecorder();
            };
            
            mediaRecorderRef.current.onerror = (event) => {
                console.error("MediaRecorder error:", event);
                toast({ title: "녹음 오류", description: "녹음 중 오류가 발생했습니다.", variant: "destructive" });
                setRecordingState('idle');
            };

            mediaRecorderRef.current.start();
            setRecordingState('recording');
        } catch (err) {
            console.error("Error accessing microphone:", err);
            toast({ title: "마이크 접근 오류", description: "마이크 권한을 허용해주세요.", variant: "destructive" });
            setRecordingState('idle');
        }
    };
    
    const handleStopRecording = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };
    
    const handleAnalyze = async () => {
        if (!audioBlob) {
            toast({ title: "오디오 파일 없음", description: "분석할 녹음 파일이 없습니다.", variant: "destructive" });
            return;
        }
        setRecordingState('analyzing');
        toast({ title: "AI 분석 시작", description: "낭독 내용을 분석하고 있습니다. 잠시만 기다려주세요." });
        
        try {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = reader.result as string;
                const result = await analyzeReadAloud({
                    audioDataUri: base64Audio,
                    originalText: selectedText,
                });
                setAnalysisResult(result);
                toast({ title: "분석 완료", description: "AI 낭독 분석이 완료되었습니다." });
                setRecordingState('idle');
            };
        } catch (error) {
            console.error("Analysis failed:", error);
            toast({ title: "분석 실패", description: "AI 분석 중 오류가 발생했습니다.", variant: "destructive" });
            setRecordingState('recorded');
        }
    };
    
    const handleReset = () => {
        setRecordingState('idle');
        setAudioBlob(null);
        setAnalysisResult(null);
        cleanupRecorder();
    };

    const renderButtons = () => {
        switch (recordingState) {
            case 'idle':
                return (
                    <div className="flex gap-2">
                        <Button onClick={handleStartRecording} className="w-full">
                            <Mic className="mr-2" /> 녹음 시작
                        </Button>
                        {audioBlob && (
                             <Button onClick={handleAnalyze} className="w-full" variant="secondary">
                                <Sparkles className="mr-2" /> 분석하기
                            </Button>
                        )}
                    </div>
                );
            case 'recording':
                return (
                    <Button onClick={handleStopRecording} variant="destructive" className="w-full">
                        <StopCircle className="mr-2 animate-pulse" /> 녹음 중지
                    </Button>
                );
            case 'recorded':
                return (
                    <div className="flex gap-2">
                        <Button onClick={handleAnalyze} className="w-full">
                           <Sparkles className="mr-2" /> 분석하기
                        </Button>
                        <Button onClick={handleStartRecording} variant="outline" className="w-full">
                            <RefreshCw className="mr-2" /> 다시 녹음
                        </Button>
                    </div>
                );
            case 'analyzing':
                return (
                    <Button disabled className="w-full">
                        <Loader2 className="mr-2 animate-spin" /> 분석 중...
                    </Button>
                );
        }
    };


    return (
        <div className="space-y-4">
             <div className="space-y-2">
                <label className="text-sm font-medium">지문 선택 또는 입력</label>
                <div className="flex gap-2">
                    <Button variant={selectedText === sampleTexts.beginner.text ? 'default' : 'outline'} onClick={() => handleSelectText('beginner')}>초급</Button>
                    <Button variant={selectedText === sampleTexts.intermediate.text ? 'default' : 'outline'} onClick={() => handleSelectText('intermediate')}>중급</Button>
                    <Button variant={selectedText === sampleTexts.advanced.text ? 'default' : 'outline'} onClick={() => handleSelectText('advanced')}>고급</Button>
                </div>
                 <Textarea 
                    value={selectedText}
                    onChange={(e) => setSelectedText(e.target.value)}
                    rows={10}
                    placeholder="여기에 따라 읽을 텍스트를 입력하세요..."
                    className="font-serif leading-relaxed"
                />
            </div>

            <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-muted/50">
                {renderButtons()}
                {audioBlob && <audio src={URL.createObjectURL(audioBlob)} controls className="w-full h-10 mt-2" />}
            </div>
            
            {analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>AI 낭독 분석 결과</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                           <ScoreDisplay label="정확도" value={analysisResult.accuracy} />
                           <ScoreDisplay label="유창성" value={analysisResult.fluency} />
                           <ScoreDisplay label="발음 점수" value={analysisResult.pronunciationScore} />
                           <ScoreDisplay label="완독률" value={analysisResult.completionRate} />
                        </div>
                        
                         <div>
                            <h3 className="text-lg font-semibold mb-2">단어별 분석</h3>
                            <TooltipProvider>
                                <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-serif text-base leading-relaxed">
                                {analysisResult.wordAnalysis.map((item, index) => {
                                    const wordClass = cn({
                                        'text-blue-600': item.status === 'correct',
                                        'text-red-600 line-through decoration-2': item.status === 'incorrect',
                                        'text-gray-400': item.status === 'omitted',
                                    });

                                    if (item.status === 'incorrect') {
                                        return (
                                        <Tooltip key={index}>
                                            <TooltipTrigger asChild>
                                            <span className={wordClass}>{item.word} </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                            <p>이렇게 발음함: "{item.spoken}"</p>
                                            </TooltipContent>
                                        </Tooltip>
                                        );
                                    }
                                    return <span key={index} className={wordClass}>{item.word} </span>;
                                    })}
                                </div>
                            </TooltipProvider>
                        </div>
                        
                         <div>
                            <h3 className="text-lg font-semibold mb-2">상세 피드백</h3>
                             <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed">
                                {analysisResult.feedback}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-2">인식된 전체 텍스트</h3>
                             <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-mono text-sm leading-relaxed italic">
                                "{analysisResult.userTranscript}"
                            </div>
                        </div>
                         <Button onClick={handleReset} variant="outline" className="w-full">
                            <RefreshCw className="mr-2" /> 새로 시작하기
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
