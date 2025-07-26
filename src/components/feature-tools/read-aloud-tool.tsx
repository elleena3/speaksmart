
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mic, StopCircle, RefreshCw, Sparkles } from 'lucide-react';
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
    const [editableText, setEditableText] = useState<string>(sampleTexts.beginner.text);
    const [analysisResult, setAnalysisResult] = useState<AnalyzeReadAloudOutput | null>(null);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const { toast } = useToast();

    // Reset everything when text changes
    useEffect(() => {
        setEditableText(selectedText);
        handleReset(false);
    }, [selectedText]);

    const cleanupRecorder = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
    }, []);

    const handleSelectText = (difficulty: Difficulty) => {
        setSelectedText(sampleTexts[difficulty].text);
    }

    const handleStartRecording = async () => {
        handleReset(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: mimeType });
                setAudioBlob(blob);
                setRecordingState('recorded');
                cleanupRecorder();
            };
            mediaRecorderRef.current.start();
            setRecordingState('recording');
        } catch (err) {
            toast({ title: "마이크 접근 오류", description: "마이크 권한을 허용해주세요.", variant: "destructive" });
        }
    };
    
    const handleStopRecording = () => mediaRecorderRef.current?.stop();
    
    const handleAnalyze = async () => {
        if (!audioBlob) return;
        setRecordingState('analyzing');
        toast({ title: "AI 분석 시작", description: "낭독 내용을 분석하고 있습니다." });
        
        try {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const result = await analyzeReadAloud({ audioDataUri: reader.result as string, originalText: editableText });
                setAnalysisResult(result);
                toast({ title: "분석 완료", description: "AI 낭독 분석이 완료되었습니다." });
                setRecordingState('recorded');
            };
        } catch (e) {
            toast({ title: "분석 실패", variant: "destructive" });
            setRecordingState('recorded');
        }
    };
    
    const handleReset = (showToast = true) => {
        setRecordingState('idle');
        setAudioBlob(null);
        setAnalysisResult(null);
        cleanupRecorder();
        if(showToast) toast({ title: "초기화 완료", description: "새로운 낭독 연습을 시작할 수 있습니다." });
    };

    return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
            <Card>
                 <CardHeader>
                    <CardTitle>지문 선택 또는 입력</CardTitle>
                    <CardDescription>아래 텍스트를 따라 읽거나, 직접 텍스트를 수정하여 연습하세요.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex gap-2">
                        <Button variant={selectedText === sampleTexts.beginner.text ? 'default' : 'outline'} onClick={() => handleSelectText('beginner')}>초급</Button>
                        <Button variant={selectedText === sampleTexts.intermediate.text ? 'default' : 'outline'} onClick={() => handleSelectText('intermediate')}>중급</Button>
                        <Button variant={selectedText === sampleTexts.advanced.text ? 'default' : 'outline'} onClick={() => handleSelectText('advanced')}>고급</Button>
                    </div>
                    <Textarea 
                        value={editableText}
                        onChange={(e) => setEditableText(e.target.value)}
                        className="p-4 bg-muted/50 rounded-lg text-lg font-serif leading-relaxed h-96 overflow-y-auto"
                    />
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>녹음 및 분석</CardTitle>
                    <CardDescription>지문을 읽고 녹음한 후, AI 분석을 받아보세요.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-center gap-2">
                         {recordingState === 'idle' && <Button onClick={handleStartRecording} className="flex-1"><Mic className="mr-2"/>녹음 시작</Button>}
                         {recordingState === 'recording' && <Button onClick={handleStopRecording} variant="destructive" className="flex-1"><StopCircle className="mr-2 animate-pulse"/>녹음 중지</Button>}
                         {recordingState === 'recorded' && <Button onClick={handleAnalyze} className="flex-1"><Sparkles className="mr-2"/>AI 분석</Button>}
                         {recordingState === 'analyzing' && <Button disabled className="flex-1"><Loader2 className="mr-2 animate-spin"/>분석 중...</Button>}
                         <Button onClick={() => handleReset()} variant="outline"><RefreshCw/></Button>
                    </div>
                     {audioBlob && <audio src={URL.createObjectURL(audioBlob)} controls className="w-full h-10" />}
                </CardContent>
            </Card>
        </div>
        
        <div className="space-y-4">
            {analysisResult ? (
                 <Card className="sticky top-4">
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
                                <div className="p-4 bg-muted/50 rounded-lg text-base leading-relaxed font-serif">
                                {analysisResult.wordAnalysis.map((item, index) => {
                                    const wordClass = cn({
                                        'text-blue-600': item.status === 'correct',
                                        'text-red-500 line-through decoration-wavy decoration-red-500': item.status === 'incorrect',
                                        'text-gray-400 font-light': item.status === 'omitted',
                                    });

                                    if (item.status === 'incorrect') {
                                        return (
                                        <Tooltip key={index}>
                                            <TooltipTrigger asChild><span className={wordClass}>{item.word}{' '}</span></TooltipTrigger>
                                            <TooltipContent><p>이렇게 발음함: "{item.spoken}"</p></TooltipContent>
                                        </Tooltip>
                                        );
                                    }
                                    return <span key={index} className={wordClass}>{item.word}{' '}</span>;
                                })}
                                </div>
                            </TooltipProvider>
                        </div>
                         <div>
                            <h3 className="text-lg font-semibold mb-2">상세 피드백</h3>
                             <div className="p-4 bg-muted/50 rounded-lg text-sm leading-relaxed">{analysisResult.feedback}</div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="h-full flex items-center justify-center">
                    <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                        <Sparkles className="mx-auto h-12 w-12 mb-4" />
                        <h3 className="text-lg font-semibold">분석 결과 대기 중</h3>
                        <p className="text-sm">낭독을 녹음하고 'AI 분석' 버튼을 누르면 결과가 여기에 표시됩니다.</p>
                    </div>
                </div>
            )}
        </div>
    </div>
    );
}
