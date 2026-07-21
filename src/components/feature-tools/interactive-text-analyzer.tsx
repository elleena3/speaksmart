
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BookOpen, Brain, MessageSquare, Speaker, Info, Wand2, Upload } from 'lucide-react';
import { enhanceSelectedText, type EnhanceSelectedTextOutput } from '@/ai/flows/enhance-selected-text-flow';
import { readAloudText } from '@/ai/flows/text-to-speech';
import { extractTextFromFile } from '@/ai/flows/extract-text-from-file';
import { sampleTexts } from '@/lib/book';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type AnalysisAction = 'translate' | 'define' | 'explain';

// Main component
export function InteractiveTextAnalyzer() {
    const [selectedText, setSelectedText] = useState<string>(sampleTexts.beginner.text);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
    const [currentSelection, setCurrentSelection] = useState('');
    const [analysisResult, setAnalysisResult] = useState<EnhanceSelectedTextOutput | null>(null);
    const [isCardLoading, setIsCardLoading] = useState(false);
    const [isReadingAloud, setIsReadingAloud] = useState(false);
    const [isExtractingText, setIsExtractingText] = useState(false);
    
    const audioPlayerRef = useRef<HTMLAudioElement>(null);
    const textContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    
    const handleDifficultyChange = (difficulty: Difficulty) => {
        if (!difficulty) return;
        setSelectedText(sampleTexts[difficulty].text);
        setAnalysisResult(null);
        setPopoverOpen(false);
        setCurrentSelection('');
    };

    const handleTextSelection = () => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        
        if (text && text.length > 0) {
            const range = selection?.getRangeAt(0);
            if (range) {
                setSelectionRect(range.getBoundingClientRect());
                setCurrentSelection(text);
                setPopoverOpen(true);
                setAnalysisResult(null); // Clear previous analysis
            }
        } else {
            setPopoverOpen(false);
        }
    };

    const handleActionClick = async (action: AnalysisAction) => {
        if (!currentSelection || !textContainerRef.current) return;
        
        setPopoverOpen(false);
        setIsCardLoading(true);
        setAnalysisResult(null);
        
        try {
            const result = await enhanceSelectedText({
                selectedText: currentSelection,
                fullSentenceContext: textContainerRef.current.innerText,
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
        if (!currentSelection || !textContainerRef.current) return;
        
        setPopoverOpen(false);
        setIsReadingAloud(true);

        try {
            const { correctedText } = await enhanceSelectedText({
                selectedText: currentSelection,
                fullSentenceContext: textContainerRef.current.innerText,
                action: 'translate', 
            });

            const _res_readAloudText = await readAloudText({ text: correctedText });
      if (!_res_readAloudText) throw new Error("서버 응답이 없습니다 (API 한도 초과 또는 내부 오류).");
      const { audioDataUri  } = _res_readAloudText;
            if (audioPlayerRef.current) {
                audioPlayerRef.current.src = audioDataUri;
                audioPlayerRef.current.play();
            }
        } catch (e: any) {
             toast({ title: "AI 리딩 오류", description: e.message, variant: "destructive" });
             setIsReadingAloud(false);
        }
    }
    
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsExtractingText(true);
        toast({ title: "파일 처리 중...", description: "파일에서 텍스트를 추출하고 있습니다."});
        
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const dataUri = reader.result as string;
                const { extractedText } = await extractTextFromFile({ fileDataUri: dataUri });
                setSelectedText(extractedText);
                toast({ title: "텍스트 추출 완료", description: "파일의 내용이 지문으로 설정되었습니다."});
                setIsExtractingText(false);
            };
        } catch (e: any) {
            toast({ title: "파일 분석 오류", description: e.message, variant: "destructive" });
            setIsExtractingText(false);
        } finally {
            // Reset file input to allow re-uploading the same file
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    useEffect(() => {
        const audioEl = audioPlayerRef.current;
        const onEnded = () => setIsReadingAloud(false);

        audioEl?.addEventListener('ended', onEnded);
        return () => {
            audioEl?.removeEventListener('ended', onEnded);
        }
    }, []);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>1. 지문 준비</CardTitle>
                        <CardDescription>연습할 지문을 선택하거나, 직접 파일을 업로드하세요.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        <ToggleGroup type="single" defaultValue="beginner" onValueChange={handleDifficultyChange} aria-label="Text difficulty">
                            <ToggleGroupItem value="beginner" aria-label="Beginner">초급</ToggleGroupItem>
                            <ToggleGroupItem value="intermediate" aria-label="Intermediate">중급</ToggleGroupItem>
                            <ToggleGroupItem value="advanced" aria-label="Advanced">고급</ToggleGroupItem>
                        </ToggleGroup>
                         <Input
                            id="file-upload"
                            type="file"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".txt,.pdf,image/*"
                         />
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isExtractingText}>
                            {isExtractingText ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                            파일 업로드
                        </Button>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>2. 텍스트 선택 및 분석</CardTitle>
                        <CardDescription>아래 지문에서 궁금한 단어, 구, 문장을 드래그하여 AI 분석 기능을 사용해보세요.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div 
                             ref={textContainerRef} 
                             onMouseUp={handleTextSelection} 
                             className="p-4 bg-muted/50 rounded-lg text-lg font-serif leading-relaxed h-96 overflow-y-auto select-text"
                        >
                            {isExtractingText ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin"/> 텍스트 추출 중...
                                </div>
                            ) : (
                                selectedText
                            )}
                        </div>
                        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                            <PopoverContent 
                                className="w-auto p-1" 
                                style={selectionRect ? { 
                                    position: 'fixed',
                                    top: `${selectionRect.top - 50}px`,
                                    left: `${selectionRect.left + selectionRect.width / 2}px`,
                                    transform: 'translateX(-50%)',
                                } : {}}
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
                         <CardDescription>지문에서 텍스트를 선택하면 AI가 분석한 정보가 여기에 표시됩니다.</CardDescription>
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
            <audio ref={audioPlayerRef} onEnded={() => setIsReadingAloud(false)} className="hidden"/>
        </div>
    );
}
