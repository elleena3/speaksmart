
"use client";

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, RefreshCw, AlertTriangle, FileUp, VideoIcon, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { analyzePresentationVideo, type AnalyzePresentationVideoOutput } from '@/ai/flows/analyze-presentation-video-flow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type AnalysisState = 'idle' | 'analyzing' | 'analyzed' | 'error';

const ScoreDisplay = ({ label, value }: { label: string; value: number }) => (
    <div>
        <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-primary">{label}</span>
            <span className="text-sm font-medium text-primary">{value} / 100</span>
        </div>
        <Progress value={value} className="h-2" />
    </div>
);

const FeedbackCard = ({ title, score, feedback }: { title: string; score: number; feedback: string }) => (
    <Card>
        <CardHeader>
            <CardTitle>{title}</CardTitle>
            <ScoreDisplay label="점수" value={score} />
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground mb-2">상세 피드백:</p>
            <div className="p-4 bg-muted/30 rounded-lg markdown-content font-body text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {feedback}
                </ReactMarkdown>
            </div>
        </CardContent>
    </Card>
);

export function PresentationAnalyzerTool() {
    const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [presentationFile, setPresentationFile] = useState<File | null>(null);
    const [customCriteria, setCustomCriteria] = useState('');
    const [analysisResult, setAnalysisResult] = useState<AnalyzePresentationVideoOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, fileType: 'video' | 'presentation') => {
        const file = event.target.files?.[0];
        if (!file) return;

        const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
        const validPresentationTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];

        if (fileType === 'video' && !validVideoTypes.includes(file.type)) {
            toast({ title: "지원하지 않는 동영상 형식", description: "MP4, WebM, MOV 형식의 동영상 파일을 선택해주세요.", variant: "destructive" });
            event.target.value = '';
            return;
        }

        if (fileType === 'presentation' && !validPresentationTypes.includes(file.type)) {
            toast({ title: "지원하지 않는 발표 자료 형식", description: "PDF 또는 PPTX 형식의 파일을 선택해주세요.", variant: "destructive" });
            event.target.value = '';
            return;
        }

        if (fileType === 'video') setVideoFile(file);
        if (fileType === 'presentation') setPresentationFile(file);
    };

    const fileToDataUri = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleAnalyze = async () => {
        if (!videoFile) {
            toast({ title: "동영상 파일 없음", description: "분석할 동영상 파일을 먼저 업로드해주세요.", variant: "destructive" });
            return;
        }
        setAnalysisState('analyzing');
        setError(null);
        setAnalysisResult(null);
        toast({ title: "AI 분석 시작", description: "발표 내용을 분석하고 있습니다. 동영상 길이에 따라 몇 분 정도 소요될 수 있습니다." });

        try {
            const videoDataUri = await fileToDataUri(videoFile);
            const presentationFileUri = presentationFile ? await fileToDataUri(presentationFile) : undefined;

            const result = await analyzePresentationVideo({
                videoDataUri,
                presentationFileUri,
                customCriteria: customCriteria || undefined,
            });

            setAnalysisResult(result);
            setAnalysisState('analyzed');
            toast({ title: "분석 완료", description: "AI 발표 분석이 완료되었습니다." });
        } catch (e: any) {
            console.error("Presentation analysis failed:", e);
            setError(e.message || "알 수 없는 오류가 발생했습니다.");
            setAnalysisState('error');
            toast({ title: "분석 실패", description: `AI 분석 중 오류가 발생했습니다: ${e.message}`, variant: "destructive" });
        }
    };

    const handleReset = () => {
        setAnalysisState('idle');
        setVideoFile(null);
        setPresentationFile(null);
        setCustomCriteria('');
        setAnalysisResult(null);
        setError(null);
        // Reset file input fields visually
        const videoInput = document.getElementById('video-upload') as HTMLInputElement;
        if (videoInput) videoInput.value = '';
        const presInput = document.getElementById('presentation-upload') as HTMLInputElement;
        if (presInput) presInput.value = '';
    };

    const isAnalyzeButtonDisabled = useMemo(() => {
        return !videoFile || analysisState === 'analyzing';
    }, [videoFile, analysisState]);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileUp /> 자료 업로드</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="video-upload" className="flex items-center gap-1">
                                <VideoIcon className="h-4 w-4" /> 동영상 파일 <span className="text-red-500">*</span>
                            </Label>
                            <Input id="video-upload" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => handleFileChange(e, 'video')} />
                            <p className="text-xs text-muted-foreground">MP4, WebM, MOV 형식, 1080p 이하</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="presentation-upload">발표 자료 (선택)</Label>
                            <Input id="presentation-upload" type="file" accept=".pdf,.pptx" onChange={(e) => handleFileChange(e, 'presentation')} />
                            <p className="text-xs text-muted-foreground">PDF, PPTX 형식</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="custom-criteria">추가 평가 요소 (선택)</Label>
                        <Textarea
                            id="custom-criteria"
                            placeholder="예: 특정 어휘('moreover', 'consequently')를 2회 이상 사용했는지 평가해주세요."
                            value={customCriteria}
                            onChange={(e) => setCustomCriteria(e.target.value)}
                            rows={3}
                        />
                        <p className="text-xs text-muted-foreground">AI가 평가 시 추가적으로 참고할 내용을 입력합니다.</p>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button onClick={handleAnalyze} disabled={isAnalyzeButtonDisabled} className="w-full">
                            {analysisState === 'analyzing' ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}
                            {analysisState === 'analyzing' ? "분석 중..." : "발표 영상 분석하기"}
                        </Button>
                        <Button onClick={handleReset} variant="outline" className="w-full">
                            <RefreshCw className="mr-2" /> 새로 시작
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {analysisState === 'analyzing' && (
                <div className="text-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="mt-4 text-muted-foreground">AI가 발표를 시청하며 분석하고 있습니다. 시간이 다소 걸릴 수 있습니다...</p>
                </div>
            )}

            {analysisState === 'error' && (
                <Card className="border-destructive">
                    <CardHeader className="flex-row items-center gap-4">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                        <div>
                            <CardTitle className="text-destructive">분석 오류</CardTitle>
                            <CardDescription className="text-destructive-foreground">{error}</CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            )}

            {analysisState === 'analyzed' && analysisResult && (
                <Card
                    data-state="open"
                    className={cn(
                        "data-[state=open]:animate-in data-[state=closed]:animate-out",
                        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                        "data-[state=open]:slide-in-from-bottom-2"
                    )}
                >
                    <CardHeader>
                        <CardTitle>AI 발표 분석 종합 결과</CardTitle>
                        <CardDescription>가중치가 적용된 최종 점수는 다음과 같습니다: 내용(40%), 언어(40%), 태도(20%)</CardDescription>
                        <div className="pt-4">
                            <ScoreDisplay label="최종 점수" value={analysisResult.overallScore} />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FeedbackCard title="1. 내용 (Content)" score={analysisResult.content.score} feedback={analysisResult.content.feedback} />
                        <FeedbackCard title="2. 언어적 능력 (Language Competence)" score={analysisResult.languageCompetence.score} feedback={analysisResult.languageCompetence.feedback} />
                        <FeedbackCard title="3. 발표 태도 (Delivery)" score={analysisResult.delivery.score} feedback={analysisResult.delivery.feedback} />

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Info /> 종합 총평</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed markdown-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {analysisResult.overallFeedback}
                                    </ReactMarkdown>
                                </div>
                            </CardContent>
                        </Card>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
