
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Youtube, Sparkles, AlertTriangle } from 'lucide-react';
import { summarizeYoutubeVideo, type SummarizeYoutubeVideoOutput } from '@/ai/flows/summarize-youtube-video-flow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type AnalysisState = 'idle' | 'analyzing' | 'analyzed' | 'error';

export function YoutubeSummarizerTool() {
    const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [analysisResult, setAnalysisResult] = useState<SummarizeYoutubeVideoOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const handleAnalyze = async () => {
        if (!youtubeUrl.trim() || !youtubeUrl.includes('youtube.com/watch?v=')) {
            toast({ title: "유효하지 않은 URL", description: "올바른 유튜브 동영상 URL을 입력해주세요.", variant: "destructive" });
            return;
        }
        setAnalysisState('analyzing');
        setError(null);
        setAnalysisResult(null);
        toast({ title: "AI 요약 시작", description: "유튜브 영상의 자막을 추출하고 요약하고 있습니다. 영상 길이에 따라 시간이 걸릴 수 있습니다." });

        try {
            const result = await summarizeYoutubeVideo({ youtubeUrl });
            setAnalysisResult(result);
            setAnalysisState('analyzed');
            toast({ title: "분석 완료", description: "유튜브 영상 요약이 완료되었습니다." });
        } catch (e: any) {
            console.error("YouTube analysis failed:", e);
            const errorMessage = e.message || "알 수 없는 오류가 발생했습니다.";
            setError(errorMessage);
            setAnalysisState('error');
            toast({ title: "분석 실패", description: errorMessage, variant: "destructive" });
        }
    };

    return (
        <CardContent className="pt-6">
            <div className="space-y-4">
                <div className="flex gap-2">
                    <div className="relative flex-grow">
                        <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            type="url" 
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="pl-10"
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleAnalyze} disabled={analysisState === 'analyzing'}>
                        {analysisState === 'analyzing' ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}
                        {analysisState === 'analyzing' ? "요약 중..." : "영상 요약하기"}
                    </Button>
                </div>

                {analysisState === 'analyzing' && (
                    <div className="text-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                        <p className="mt-2 text-sm text-muted-foreground">AI가 영상을 시청하고 요약본을 작성하고 있습니다...</p>
                    </div>
                )}

                {analysisState === 'error' && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                         <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-1"/>
                         <div>
                            <h4 className="font-semibold text-destructive">오류 발생</h4>
                            <p className="text-sm text-destructive/80">{error}</p>
                         </div>
                    </div>
                )}

                {analysisState === 'analyzed' && analysisResult && (
                    <div className="p-4 bg-muted/50 rounded-lg markdown-content">
                         <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {analysisResult.summary}
                         </ReactMarkdown>
                    </div>
                )}
            </div>
        </CardContent>
    );
}
