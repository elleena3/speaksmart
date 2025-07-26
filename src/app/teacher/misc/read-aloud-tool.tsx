

"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mic, StopCircle, RefreshCw, Sparkles, BookOpen, Brain, MessageSquare, AudioLines, Speaker, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { analyzeReadAloud, type AnalyzeReadAloudOutput } from '@/ai/flows/analyze-read-aloud-flow';
import { enhanceSelectedText, type EnhanceSelectedTextOutput } from '@/ai/flows/enhance-selected-text-flow';
import { readAloudText } from '@/ai/flows/text-to-speech';
import { sampleTexts } from '@/lib/book';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type RecordingState = 'idle' | 'recording' | 'recorded' | 'analyzing';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type AnalysisAction = 'translate' | 'define' | 'explain';
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
    
    // State for interactive features
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
    const [currentSelection, setCurrentSelection] = useState('');
    const [analysisCardContent, setAnalysisCardContent] = useState<EnhanceSelectedTextOutput | null>(null);
    const [isCardLoading, setIsCardLoading] = useState(false);
    const [isReadingAloud, setIsReadingAloud] = useState(false);
    const audioPlayerRef = useRef<HTMLAudioElement>(null);


    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const { toast } = useToast();

    // Reset everything when text changes
    useEffect(() => {
        handleReset(false);
    }, [selectedText]);

    const cleanupRecorder = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
    }, []);

    const handleTextSelection = () => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (text && text.length > 1) {
            const range = selection?.getRangeAt(0);
            if (range) {
                setSelectionRect(range.getBoundingClientRect());
                setCurrentSelection(text);
                setPopoverOpen(true);
                setAnalysisCardContent(null);
            }
        } else {
            setPopoverOpen(false);
        }
    };

    const handleActionClick = async (action: AnalysisAction) => {
        setPopoverOpen(false);
        setIsCardLoading(true);
        setAnalysisCardContent(null);
        
        try {
            const selection = window.getSelection();
            const range = selection?.getRangeAt(0);
            if (!range) throw new Error("No text selected.");

            const surroundingNode = range.commonAncestorContainer;
            const fullSentenceContext = surroundingNode.textContent || '';
            
            const result = await enhanceSelectedText({
                selectedText: currentSelection,
                fullSentenceContext,
                action,
            });
            setAnalysisCardContent(result);
        } catch (e: any) {
            toast({ title: "분석 오류", description: e.message, variant: "destructive" });
        } finally {
            setIsCardLoading(false);
        }
    };
    
    const handleReadAloudClick = async () => {
        setPopoverOpen(false);
        setIsReadingAloud(true);
        try {
            const textToRead = currentSelection;
            const { audioDataUri } = await readAloudText({ text: textToRead });
            if (audioPlayerRef.current) {
                audioPlayerRef.current.src = audioDataUri;
                audioPlayerRef.current.play();
            }
        } catch (e: any) {
             toast({ title: "AI 리딩 오류", description: e.message, variant: "destructive" });
             setIsReadingAloud(false);
        }
    }


    const handleSelectText = (difficulty: Difficulty) => {
        setSelectedText(sampleTexts[difficulty].text);
    }

    const handleStartRecording = async () => {
        handleReset();
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
                const result = await analyzeReadAloud({ audioDataUri: reader.result as string, originalText: selectedText });
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
        setPopoverOpen(false);
        setCurrentSelection('');
        setAnalysisCardContent(null);
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
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                            <div
                                onMouseUp={handleTextSelection}
                                className="p-4 bg-muted/50 rounded-lg text-lg font-serif leading-relaxed h-96 overflow-y-auto select-text"
                            >
                                {selectedText}
                            </div>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-auto p-1"
                            style={selectionRect ? { top: `${selectionRect.top - 50}px`, left: `${selectionRect.left}px` } : {}}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleActionClick('translate')}><BookOpen className="mr-1 h-4 w-4"/>번역</Button>
                                <Button variant="ghost" size="sm" onClick={() => handleActionClick('define')}><Brain className="mr-1 h-4 w-4"/>사전</Button>
                                <Button variant="ghost" size="sm" onClick={() => handleActionClick('explain')}><MessageSquare className="mr-1 h-4 w-4"/>해설</Button>
                                <Button variant="ghost" size="sm" onClick={handleReadAloudClick} disabled={isReadingAloud}>
                                    {isReadingAloud ? <Loader2 className="animate-spin h-4 w-4"/> : <Speaker className="mr-1 h-4 w-4"/>}
                                    리딩
                                </Button>
                                 <audio ref={audioPlayerRef} onEnded={() => setIsReadingAloud(false)} className="hidden"/>
                            </div>
                        </PopoverContent>
                    </Popover>
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
                 <Card className="sticky top-4">
                     <CardHeader>
                         <CardTitle className="flex items-center gap-2">
                             {isCardLoading || analysisCardContent ? <AudioLines/> : <Info/>}
                             텍스트 분석 도구
                         </CardTitle>
                         <CardDescription>지문에서 단어나 구를 선택하여 번역, 사전, 해설, 리딩 기능을 사용해보세요.</CardDescription>
                     </CardHeader>
                     <CardContent className="min-h-[200px]">
                         {isCardLoading ? (
                             <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
                         ) : analysisCardContent ? (
                             <div className="space-y-4">
                                 <p className="font-semibold text-primary">"{analysisCardContent.correctedText}"</p>
                                 <p className="text-sm">{analysisCardContent.result}</p>
                             </div>
                         ) : (
                             <div className="text-center text-muted-foreground pt-10">결과가 여기에 표시됩니다.</div>
                         )}
                     </CardContent>
                 </Card>
            )}
        </div>
    </div>
    );
}

