
"use client";

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, RefreshCw, AlertTriangle, FileUp, VideoIcon } from 'lucide-react';
import { analyzeVideo, type AnalyzeVideoOutput } from '@/ai/flows/analyze-video-flow';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/auth-context';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';


type AnalysisState = 'idle' | 'uploading' | 'analyzing' | 'analyzed' | 'error';

export function VideoAnalyzerTool() {
    const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState('');
    const [analysisResult, setAnalysisResult] = useState<AnalyzeVideoOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { user } = useAuth();
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov', 'video/avi', 'video/x-flv'];
        if (!validVideoTypes.includes(file.type)) {
            toast({ title: "지원하지 않는 동영상 형식", description: "MP4, WebM, MOV 등의 동영상 파일을 선택해주세요.", variant: "destructive" });
            event.target.value = '';
            return;
        }
        setVideoFile(file);
        setAnalysisState('idle');
        setAnalysisResult(null);
        setError(null);
    };

    const handleAnalyze = async () => {
        if (!videoFile) {
            toast({ title: "동영상 파일 없음", description: "분석할 동영상 파일을 먼저 업로드해주세요.", variant: "destructive" });
            return;
        }
        if (!prompt.trim()) {
            toast({ title: "요구사항 없음", description: "AI에게 요청할 내용을 입력해주세요.", variant: "destructive" });
            return;
        }
        if (!user) {
            toast({ title: "로그인 필요", description: "파일을 업로드하려면 로그인이 필요합니다.", variant: "destructive" });
            return;
        }

        setUploadProgress(0);
        setAnalysisResult(null);
        setError(null);
        setAnalysisState('uploading');

        const filePath = `misc-uploads/${user.uid}/${Date.now()}_${videoFile.name}`;
        const storageRef = ref(storage, filePath);
        const uploadTask = uploadBytesResumable(storageRef, videoFile);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Upload failed:", error);
                toast({ title: "업로드 실패", description: "파일을 업로드하는 중 오류가 발생했습니다.", variant: "destructive" });
                setAnalysisState('error');
                setError("파일 업로드 실패.");
            },
            async () => {
                try {
                    const bucket = uploadTask.snapshot.ref.bucket;
                    const gcsUri = `gs://${bucket}/${filePath}`;
                    
                    setAnalysisState('analyzing');
                    toast({ title: "업로드 완료, 분석 시작", description: "AI가 동영상을 분석하고 있습니다." });

                    const result = await analyzeVideo({
                        videoUri: gcsUri,
                        prompt
                    });
                    
                    setAnalysisResult(result);
                    setAnalysisState('analyzed');
                    toast({ title: "분석 완료", description: "AI 동영상 분석이 완료되었습니다." });

                } catch (e: any) {
                    console.error("Video analysis failed:", e);
                    setError(e.message || "알 수 없는 오류가 발생했습니다.");
                    setAnalysisState('error');
                    toast({ title: "분석 실패", description: `AI 분석 중 오류가 발생했습니다: ${e.message}`, variant: "destructive" });
                }
            }
        );
    };
    
    const handleReset = () => {
        setAnalysisState('idle');
        setVideoFile(null);
        setPrompt('');
        setAnalysisResult(null);
        setError(null);
        setUploadProgress(0);
        const videoInput = document.getElementById('video-analyzer-upload') as HTMLInputElement;
        if(videoInput) videoInput.value = '';
    };

    const isAnalyzeButtonDisabled = useMemo(() => {
        return !videoFile || !prompt.trim() || analysisState === 'analyzing' || analysisState === 'uploading';
    }, [videoFile, prompt, analysisState]);

    const getButtonText = () => {
        if(analysisState === 'uploading') return `업로드 중... (${uploadProgress.toFixed(0)}%)`;
        if(analysisState === 'analyzing') return '분석 중...';
        return '동영상 분석하기';
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileUp/>자료 업로드 및 분석 요청</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="video-analyzer-upload" className="flex items-center gap-1">
                            <VideoIcon className="h-4 w-4"/> 동영상 파일 <span className="text-red-500">*</span>
                        </Label>
                        <Input id="video-analyzer-upload" type="file" accept="video/*" onChange={handleFileChange} />
                        <p className="text-xs text-muted-foreground">대부분의 동영상 형식을 지원합니다. (예: MP4, MOV, WebM 등)</p>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="analysis-prompt">분석 요구사항 <span className="text-red-500">*</span></Label>
                        <Textarea 
                            id="analysis-prompt"
                            placeholder="예: 영상에 나오는 모든 텍스트를 추출해줘. / 영상 속 인물의 감정 변화를 시간 순서대로 설명해줘."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={4}
                        />
                         <p className="text-xs text-muted-foreground">AI에게 동영상에 대해 무엇을 분석할지 구체적으로 요청합니다.</p>
                    </div>
                    { (analysisState === 'uploading' || analysisState === 'analyzing') && (
                       <Progress value={uploadProgress} />
                    )}
                    <div className="flex gap-2 pt-2">
                        <Button onClick={handleAnalyze} disabled={isAnalyzeButtonDisabled} className="w-full">
                            {analysisState === 'uploading' || analysisState === 'analyzing' ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}
                            {getButtonText()}
                        </Button>
                        <Button onClick={handleReset} variant="outline" className="w-full">
                            <RefreshCw className="mr-2" /> 새로 시작
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {analysisState === 'analyzing' && !analysisResult && (
                <div className="text-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="mt-4 text-muted-foreground">AI가 동영상을 분석하고 있습니다. 시간이 다소 걸릴 수 있습니다...</p>
                </div>
            )}

            {analysisState === 'error' && (
                <Card className="border-destructive">
                    <CardHeader className="flex-row items-center gap-4">
                        <AlertTriangle className="h-8 w-8 text-destructive"/>
                        <div>
                            <CardTitle className="text-destructive">분석 오류</CardTitle>
                            <CardDescription className="text-destructive-foreground">{error}</CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            )}

            {analysisState === 'analyzed' && analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>AI 동영상 분석 결과</CardTitle>
                        <CardDescription>입력한 요구사항에 대한 AI의 분석 결과입니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed">
                            {analysisResult.analysis}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
