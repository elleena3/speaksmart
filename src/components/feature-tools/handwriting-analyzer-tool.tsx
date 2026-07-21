
"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Sparkles, RefreshCw } from 'lucide-react';
import { analyzeHandwriting, type AnalyzeHandwritingOutput } from '@/ai/flows/analyze-handwriting-flow';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { evaluationModels, type EvaluationModel } from '@/lib/types';
import { Label } from '../ui/label';


type AnalysisState = 'idle' | 'analyzing' | 'analyzed' | 'error';

export function HandwritingAnalyzerTool() {
    const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageDataUri, setImageDataUri] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalyzeHandwritingOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<EvaluationModel>('googleai/gemini-3.5-flash');
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast({ title: "잘못된 파일 형식", description: "이미지 파일(jpg, png 등)을 선택해주세요.", variant: "destructive" });
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const dataUri = reader.result as string;
            setImagePreview(URL.createObjectURL(file));
            setImageDataUri(dataUri);
            setAnalysisState('idle');
            setAnalysisResult(null);
            setError(null);
        };
    };

    const handleAnalyze = async () => {
        if (!imageDataUri) {
            toast({ title: "이미지 없음", description: "분석할 이미지를 먼저 업로드해주세요.", variant: "destructive" });
            return;
        }
        setAnalysisState('analyzing');
        setError(null);
        setAnalysisResult(null);
        toast({ title: "AI 분석 시작", description: `[${selectedModel}] 모델을 사용하여 자필 내용을 분석하고 있습니다.` });

        try {
            const result = await analyzeHandwriting({ imageDataUri, model: selectedModel });
            setAnalysisResult(result);
            setAnalysisState('analyzed');
            toast({ title: "분석 완료", description: "AI 자필 분석이 완료되었습니다." });
        } catch (e: any) {
            console.error("Handwriting analysis failed:", e);
            setError(e.message || "알 수 없는 오류가 발생했습니다.");
            setAnalysisState('error');
            toast({ title: "분석 실패", description: "AI 분석 중 오류가 발생했습니다.", variant: "destructive" });
        }
    };
    
    const handleReset = () => {
        setAnalysisState('idle');
        setImagePreview(null);
        setImageDataUri(null);
        setAnalysisResult(null);
        setError(null);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="image-upload" className="text-sm font-medium">자필 이미지 업로드</Label>
                        <Input id="image-upload" type="file" accept="image/*" onChange={handleFileChange} />
                    </div>
                     <div>
                        <Label htmlFor="model-select" className="text-sm font-medium">AI 평가 모델 선택</Label>
                        <Select onValueChange={(value) => setSelectedModel(value as EvaluationModel)} value={selectedModel}>
                            <SelectTrigger id="model-select">
                                <SelectValue placeholder="모델을 선택하세요..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="googleai/gemini-3.5-flash">gemini-3.5-flash (빠름)</SelectItem>
                                <SelectItem value="googleai/gemini-3.1-pro-preview">gemini-3.1-pro-preview (고성능)</SelectItem>
                            </SelectContent>
                        </Select>
                     </div>
                    <Button onClick={handleAnalyze} disabled={!imageDataUri || analysisState === 'analyzing'} className="w-full mt-2">
                        {analysisState === 'analyzing' ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}
                        {analysisState === 'analyzing' ? "분석 중..." : "자필 분석하기"}
                    </Button>
                     {(analysisState === 'analyzed' || analysisState === 'error') && (
                        <Button onClick={handleReset} variant="outline" className="w-full">
                            <RefreshCw className="mr-2" /> 새로 시작하기
                        </Button>
                    )}
                </div>
                <div className="flex items-center justify-center p-2 border rounded-lg bg-muted/50 min-h-[200px]">
                    {imagePreview ? (
                        <Image src={imagePreview} alt="Handwriting preview" width={400} height={300} className="object-contain max-h-[300px] rounded-md" />
                    ) : (
                        <p className="text-muted-foreground text-center">이미지를 업로드하면 여기에 미리보기가 표시됩니다.</p>
                    )}
                </div>
            </div>

            {analysisState === 'analyzing' && (
                <div className="text-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="mt-4 text-muted-foreground">AI가 글씨를 꼼꼼히 읽고 있습니다...</p>
                </div>
            )}

            {analysisState === 'error' && (
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">분석 오류</CardTitle>
                        <CardDescription>{error}</CardDescription>
                    </CardHeader>
                </Card>
            )}

            {analysisState === 'analyzed' && analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>AI 자필 분석 결과</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">AI 판독 텍스트</h3>
                             <TooltipProvider>
                                <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-serif text-lg leading-relaxed">
                                    {analysisResult.wordAnalysis.map((item, index) => {
                                        const wordClass = cn({
                                            'text-blue-600': item.status === 'clear',
                                            'text-red-600 font-bold underline decoration-wavy': item.status === 'needs_improvement',
                                        });

                                        if (item.status === 'needs_improvement' && item.feedback) {
                                            return (
                                                <Tooltip key={index}>
                                                    <TooltipTrigger asChild>
                                                        <span className={wordClass}>{item.word} </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>피드백: {item.feedback}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            );
                                        }
                                        return <span key={index} className={wordClass}>{item.word} </span>;
                                    })}
                                    {analysisResult.wordAnalysis.length === 0 && (
                                        <p className="italic text-muted-foreground">{analysisResult.transcript || "판독된 텍스트가 없습니다."}</p>
                                    )}
                                </div>
                            </TooltipProvider>
                        </div>
                         <div>
                            <h3 className="text-lg font-semibold mb-2">종합 피드백</h3>
                             <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed">
                                {analysisResult.overallFeedback}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
