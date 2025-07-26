
"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BookOpen, Brain, MessageSquare, Speaker, Info, Wand2 } from 'lucide-react';
import { enhanceSelectedText, type EnhanceSelectedTextOutput } from '@/ai/flows/enhance-selected-text-flow';
import { readAloudText } from '@/ai/flows/text-to-speech';
import { sampleTexts } from '@/lib/book';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type AnalysisAction = 'translate' | 'define' | 'explain';

// Main component
export function InteractiveTextAnalyzer() {
    const [selectedText, setSelectedText] = useState<string>(sampleTexts.beginner.text);
    const [popoverState, setPopoverState] = useState<{ open: boolean, target: HTMLElement | null, selection: string }>({ open: false, target: null, selection: '' });
    const [analysisResult, setAnalysisResult] = useState<EnhanceSelectedTextOutput | null>(null);
    const [isCardLoading, setIsCardLoading] = useState(false);
    const [isReadingAloud, setIsReadingAloud] = useState(false);
    
    const audioPlayerRef = useRef<HTMLAudioElement>(null);
    const textContainerRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    
    const handleDifficultyChange = (difficulty: Difficulty) => {
        if (!difficulty) return;
        setSelectedText(sampleTexts[difficulty].text);
        setAnalysisResult(null);
        setPopoverState({ open: false, target: null, selection: '' });
    };

    const handleWordClick = (event: React.MouseEvent<HTMLSpanElement>) => {
        const clickedWord = event.currentTarget.innerText;
        setAnalysisResult(null);
        setPopoverState({ open: true, target: event.currentTarget, selection: clickedWord });
    }

    const handleActionClick = async (action: AnalysisAction) => {
        if (!popoverState.selection || !textContainerRef.current) return;
        
        setPopoverState(prev => ({ ...prev, open: false }));
        setIsCardLoading(true);
        setAnalysisResult(null);
        
        try {
            const result = await enhanceSelectedText({
                selectedText: popoverState.selection,
                fullSentenceContext: textContainerRef.current.innerText, // Pass full text for context
                action,
            });
            setAnalysisResult(result);
        } catch (e: any) {
            toast({ title: "분석 오류", description: e.message, variant: "destructive" });
        } finally {
            setIsCardLoading(false);
        }
    };
    
    const handleReadAloudClick = async () => {
        if (!popoverState.selection) return;

        setPopoverState(prev => ({ ...prev, open: false }));
        setIsReadingAloud(true);

        try {
            const { audioDataUri } = await readAloudText({ text: popoverState.selection });
            if (audioPlayerRef.current) {
                audioPlayerRef.current.src = audioDataUri;
                audioPlayerRef.current.play();
            }
        } catch (e: any) {
             toast({ title: "AI 리딩 오류", description: e.message, variant: "destructive" });
             setIsReadingAloud(false);
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>1. 지문 선택</CardTitle>
                        <CardDescription>연습할 난이도의 지문을 선택하세요.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ToggleGroup type="single" defaultValue="beginner" onValueChange={handleDifficultyChange} aria-label="Text difficulty">
                            <ToggleGroupItem value="beginner" aria-label="Beginner">초급</ToggleGroupItem>
                            <ToggleGroupItem value="intermediate" aria-label="Intermediate">중급</ToggleGroupItem>
                            <ToggleGroupItem value="advanced" aria-label="Advanced">고급</ToggleGroupItem>
                        </ToggleGroup>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>2. 단어 클릭</CardTitle>
                        <CardDescription>아래 지문에서 궁금한 단어를 클릭하여 AI 분석 기능을 사용해보세요.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Popover open={popoverState.open} onOpenChange={(open) => setPopoverState(prev => ({...prev, open}))}>
                            <PopoverTrigger asChild>
                                <div ref={textContainerRef} className="p-4 bg-muted/50 rounded-lg text-lg font-serif leading-relaxed h-96 overflow-y-auto cursor-pointer">
                                    {selectedText.split(/(\s+)/).map((word, index) => (
                                        word.trim() ? 
                                        <span key={index} onClick={handleWordClick} className="hover:bg-blue-200 rounded p-0.5">{word}</span>
                                        : <span key={index}>{word}</span>
                                    ))}
                                </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-1" side="top" align="center">
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
            </div>
            
            <div className="sticky top-4">
                 <Card>
                     <CardHeader>
                         <CardTitle className="flex items-center gap-2">
                             <Wand2 className="text-primary"/> AI 분석 결과
                         </CardTitle>
                         <CardDescription>단어를 클릭하면 AI가 분석한 정보가 여기에 표시됩니다.</CardDescription>
                     </CardHeader>
                     <CardContent className="min-h-[300px]">
                         {isCardLoading ? (
                             <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                         ) : analysisResult ? (
                             <div className="space-y-4">
                                 <h3 className="text-lg font-bold text-primary">"{analysisResult.correctedText}"</h3>
                                 <Separator />
                                 <p className="text-base">{analysisResult.result}</p>
                             </div>
                         ) : (
                             <div className="text-center text-muted-foreground pt-16 flex flex-col items-center">
                                <Info className="h-8 w-8 mb-2"/>
                                <p>분석 결과가 여기에 표시됩니다.</p>
                             </div>
                         )}
                     </CardContent>
                 </Card>
            </div>
        </div>
    );
}

    