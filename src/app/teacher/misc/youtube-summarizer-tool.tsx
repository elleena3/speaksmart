"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Youtube, Sparkles, AlertTriangle, Copy, FileText, Download } from 'lucide-react';
import { summarizeYoutubeVideo, type SummarizeYoutubeVideoOutput } from '@/ai/flows/summarize-youtube-video-flow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type EvaluationModel } from '@/lib/types';
import { Label } from '@/components/ui/label';
import ReactPlayer from 'react-player';
import { YoutubeChatPanel } from '@/components/feature-tools/youtube-chat-panel';

type AnalysisState = 'idle' | 'analyzing' | 'analyzed' | 'error';
type OutputFormat = 'default' | 'blog' | 'mindmap' | 'script';

export function YoutubeSummarizerTool() {
    const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [selectedModel, setSelectedModel] = useState<EvaluationModel>('googleai/gemini-3.1-pro-preview');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('default');

    const [analysisResult, setAnalysisResult] = useState<SummarizeYoutubeVideoOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const playerRef = useRef<any>(null);

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
            const result = await summarizeYoutubeVideo({
                youtubeUrl,
                evaluationModel: selectedModel,
                outputFormat
            });
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

    const handleJumpToTime = (timeStr: string) => {
        if (!playerRef.current) return;
        const parts = timeStr.split(':');
        let seconds = 0;
        if (parts.length === 2) {
            seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        } else if (parts.length === 3) {
            seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
        }
        playerRef.current.seekTo(seconds, 'seconds');
    };

    const handleCopy = () => {
        if (analysisResult?.summary) {
            navigator.clipboard.writeText(analysisResult.summary);
            toast({ title: "복사 완료", description: "요약 내용이 클립보드에 복사되었습니다." });
        }
    };

    // A simple hack to trigger print for the summary area and hide the rest using custom print styles
    const handleSavePDF = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow && analysisResult?.summary) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>유튜브 요약 리포트</title>
                        <style>
                            body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; padding: 20px; color: #333; }
                            h1, h2, h3 { color: #111; }
                            .timestamp { color: #0066cc; font-weight: bold; }
                        </style>
                    </head>
                    <body>
                        <div class="markdown-body">
                            ${analysisResult.summary.replace(/(\[\d{2}:\d{2}\])/g, '<span class="timestamp">$1</span>')}
                        </div>
                        <script>window.print(); window.close();</script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };


    const renderMarkdown = (text: string) => (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                a: ({ node, ...props }) => {
                    const txt = props.children?.toString() || '';
                    if (txt.match(/^\[\d{2}:\d{2}\]$/)) {
                        return (
                            <button
                                onClick={(e) => { e.preventDefault(); handleJumpToTime(txt.replace(/\[|\]/g, '')); }}
                                className="text-primary hover:underline px-1 bg-primary/10 rounded cursor-pointer font-semibold mx-1"
                            >
                                {txt}
                            </button>
                        );
                    }
                    return <a {...props} className="text-primary hover:underline" />;
                }
            }}
        >
            {text.replace(/(\[\d{2}:\d{2}\])/g, '[$1]($1)')}
        </ReactMarkdown>
    );

    return (
        <CardContent className="pt-6">
            <div className="space-y-6">
                {/* 1. URL Input Block */}
                <div>
                    <Label className="text-sm font-medium mb-2 block">1. 유튜브 영상 URL 입력</Label>
                    <div className="flex gap-2">
                        <div className="relative flex-grow">
                            <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                type="url"
                                placeholder="https://www.youtube.com/watch?v=..."
                                className="pl-10"
                                value={youtubeUrl}
                                onChange={(e) => {
                                    setYoutubeUrl(e.target.value);
                                    setAnalysisState('idle');
                                }}
                            />
                        </div>
                    </div>
                    {/* Render Player if URL is somewhat valid */}
                    {youtubeUrl.includes('youtube.com') && (
                        <div className="mt-4 rounded-xl overflow-hidden shadow-sm aspect-video bg-black/5 flex items-center justify-center">
                            {/* @ts-ignore */}
                            <ReactPlayer
                                ref={playerRef}
                                url={youtubeUrl}
                                controls
                                width="100%"
                                height="100%"
                            />
                        </div>
                    )}
                </div>

                {/* 2. Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label className="text-sm font-medium mb-2 block">2. AI 분석 모델 선택</Label>
                        <Select onValueChange={(value) => setSelectedModel(value as EvaluationModel)} value={selectedModel}>
                            <SelectTrigger>
                                <SelectValue placeholder="분석에 사용할 AI 모델을 선택하세요" />
                            </SelectTrigger>
                            <SelectContent className="min-w-[400px]">
                                <SelectItem value="googleai/gemini-3.6-flash">Gemini 3.6 Flash (무료/초고속)</SelectItem>
                                <SelectItem value="googleai/gemini-3.1-pro-preview">Gemini 3.1 Pro Preview (가성비/고품질)</SelectItem>
                                <SelectItem value="openai/gpt-5.6-luna">GPT-5.6 Luna ($1/입력, $6/출력)</SelectItem>
                                <SelectItem value="openai/gpt-5.6-terra">GPT-5.6 Terra ($2.5/입력, $15/출력)</SelectItem>
                                <SelectItem value="openai/gpt-5.6-sol">GPT-5.6 Sol ($5/입력, $30/출력)</SelectItem>
                                <SelectItem value="anthropic/claude-sonnet-5">Claude 5 Sonnet (중간 모델/속도지능 균형)</SelectItem>
                                <SelectItem value="anthropic/claude-opus-4-8">Claude Opus 4.8 (가장 고가/초거대 분석)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label className="text-sm font-medium mb-2 block">3. 출력 포맷 설정</Label>
                        <Select onValueChange={(value) => setOutputFormat(value as OutputFormat)} value={outputFormat}>
                            <SelectTrigger>
                                <SelectValue placeholder="출력 형식" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">기본 구조형 (Bullet points)</SelectItem>
                                <SelectItem value="blog">블로그 포스팅용 초안</SelectItem>
                                <SelectItem value="mindmap">마인드맵 (트리 구조)</SelectItem>
                                <SelectItem value="script">대본/스크립트 양식</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="pt-2">
                    <Button onClick={handleAnalyze} disabled={analysisState === 'analyzing'} className="w-full h-12 text-md">
                        {analysisState === 'analyzing' ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}
                        {analysisState === 'analyzing' ? "AI 영상 분석/요약 전문 작성 중..." : "AI 스마트 영상 분석 시작하기"}
                    </Button>
                </div>

                {analysisState === 'analyzing' && (
                    <div className="text-center p-8 bg-muted/20 rounded-xl border border-dashed">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <h4 className="mt-4 font-medium">영상을 꼼꼼하게 시청하고 있습니다.</h4>
                        <p className="mt-1 text-sm text-muted-foreground">선택하신 포맷({outputFormat})과 모델({selectedModel})을 적용하여 요약본을 작성 중입니다.</p>
                    </div>
                )}

                {analysisState === 'error' && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-1" />
                        <div>
                            <h4 className="font-semibold text-destructive">오류 발생</h4>
                            <p className="text-sm text-destructive/80">{error}</p>
                        </div>
                    </div>
                )}

                {analysisState === 'analyzed' && analysisResult && (
                    <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-stretch mt-8 pt-6 border-t animate-in fade-in slide-in-from-bottom-4">
                        {/* Left column: Summary */}
                        <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold flex items-center">
                                    <FileText className="w-5 h-5 mr-2 text-primary" />
                                    AI 분석 리포트
                                </h3>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={handleCopy}>
                                        <Copy className="w-4 h-4 mr-2" /> 복사
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleSavePDF}>
                                        <Download className="w-4 h-4 mr-2" /> PDF 저장
                                    </Button>
                                </div>
                            </div>
                            <div className="p-6 bg-muted/20 border rounded-xl markdown-content prose max-w-none flex-grow">
                                {renderMarkdown(analysisResult.summary)}
                            </div>
                        </div>

                        {/* Right column: Chat Panel */}
                        <div className="h-full min-h-[500px]">
                            {analysisResult.transcript ? (
                                <YoutubeChatPanel
                                    transcript={analysisResult.transcript}
                                    model={selectedModel}
                                    onJumpToTime={handleJumpToTime}
                                />
                            ) : (
                                <div className="h-full flex items-center justify-center p-6 border rounded-xl bg-muted/20 text-muted-foreground text-sm text-center">
                                    스크립트 데이터가 없어 채팅을 지원하지 않습니다.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </CardContent>
    );
}
