
"use client";

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, RefreshCw, AlertTriangle, FileUp, Info } from 'lucide-react';
import { analyzeHandwritingSubmission, type AnalyzeHandwritingSubmissionOutput } from '@/ai/flows/analyze-handwriting-submission-flow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Label } from '@/components/ui/label';

type AnalysisState = 'idle' | 'analyzing' | 'analyzed' | 'error';
const validFileTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export function HandwritingSubmissionAnalyzerTool() {
    const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
    const [studentFile, setStudentFile] = useState<File | null>(null);
    const [criteriaFile, setCriteriaFile] = useState<File | null>(null);
    const [criteriaText, setCriteriaText] = useState('');
    const [analysisResult, setAnalysisResult] = useState<AnalyzeHandwritingSubmissionOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, fileType: 'student' | 'criteria') => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!validFileTypes.includes(file.type)) {
            toast({ title: "지원하지 않는 파일 형식", description: "이미지(JPG, PNG) 또는 PDF 파일을 선택해주세요.", variant: "destructive" });
            event.target.value = '';
            return;
        }

        if (fileType === 'student') setStudentFile(file);
        if (fileType === 'criteria') setCriteriaFile(file);
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
        if (!studentFile) {
            toast({ title: "학생 과제물 없음", description: "분석할 학생의 과제물 파일을 먼저 업로드해주세요.", variant: "destructive" });
            return;
        }
        setAnalysisState('analyzing');
        setError(null);
        setAnalysisResult(null);
        toast({ title: "AI 분석 시작", description: "과제물을 분석하고 있습니다. 내용에 따라 시간이 소요될 수 있습니다." });

        try {
            const studentSubmissionUri = await fileToDataUri(studentFile);
            const criteriaFileUri = criteriaFile ? await fileToDataUri(criteriaFile) : undefined;
            
            const result = await analyzeHandwritingSubmission({
                studentSubmissionUri,
                criteriaFileUri,
                criteriaText: criteriaText || undefined,
            });
            
            setAnalysisResult(result);
            setAnalysisState('analyzed');
            toast({ title: "분석 완료", description: "AI 과제물 분석이 완료되었습니다." });
        } catch (e: any) {
            console.error("Analysis failed:", e);
            setError(e.message || "알 수 없는 오류가 발생했습니다.");
            setAnalysisState('error');
            toast({ title: "분석 실패", description: `AI 분석 중 오류가 발생했습니다: ${e.message}`, variant: "destructive" });
        }
    };
    
    const handleReset = () => {
        setAnalysisState('idle');
        setStudentFile(null);
        setCriteriaFile(null);
        setCriteriaText('');
        setAnalysisResult(null);
        setError(null);
        
        const studentInput = document.getElementById('student-upload') as HTMLInputElement;
        if(studentInput) studentInput.value = '';
        const criteriaInput = document.getElementById('criteria-upload') as HTMLInputElement;
        if(criteriaInput) criteriaInput.value = '';
    };

    const isAnalyzeButtonDisabled = useMemo(() => {
        return !studentFile || analysisState === 'analyzing';
    }, [studentFile, analysisState]);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileUp/> 자료 업로드</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="student-upload">학생 과제물 (이미지/PDF) <span className="text-red-500">*</span></Label>
                            <Input id="student-upload" type="file" accept={validFileTypes.join(',')} onChange={(e) => handleFileChange(e, 'student')} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="criteria-upload">채점 기준 자료 (이미지/PDF, 선택)</Label>
                            <Input id="criteria-upload" type="file" accept={validFileTypes.join(',')} onChange={(e) => handleFileChange(e, 'criteria')} />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="custom-criteria">채점 기준 (텍스트, 선택)</Label>
                        <Textarea 
                            id="custom-criteria"
                            placeholder="파일 대신 텍스트로 채점 기준을 입력할 수 있습니다. 예: 1. 단어의 철자가 정확한가? 2. 문법적으로 올바른 문장을 사용했는가?"
                            value={criteriaText}
                            onChange={(e) => setCriteriaText(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button onClick={handleAnalyze} disabled={isAnalyzeButtonDisabled} className="w-full">
                            {analysisState === 'analyzing' ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}
                            {analysisState === 'analyzing' ? "분석 중..." : "과제물 분석하기"}
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
                    <p className="mt-4 text-muted-foreground">AI가 과제물을 꼼꼼히 채점하고 있습니다...</p>
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
                        <CardTitle>AI 자필 과제 분석 결과</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Info/> 학생용 피드백</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 bg-muted/50 rounded-lg markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {analysisResult.studentFeedback}
                                </ReactMarkdown>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Info/> 교사용 지도 조언</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed">
                                {analysisResult.teacherGuidance}
                            </CardContent>
                        </Card>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
