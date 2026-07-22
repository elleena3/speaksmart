
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { evaluationModels, type EvaluationModel } from '@/lib/types';


type AnalysisState = 'idle' | 'analyzing' | 'analyzed' | 'error';
const validFileTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export function HandwritingSubmissionAnalyzerTool() {
    const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
    const [studentFiles, setStudentFiles] = useState<File[]>([]);
    const [criteriaFile, setCriteriaFile] = useState<File | null>(null);
    const [criteriaText, setCriteriaText] = useState('');
    const [analysisResult, setAnalysisResult] = useState<AnalyzeHandwritingSubmissionOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<EvaluationModel>('googleai/gemini-3.6-flash');
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, fileType: 'student' | 'criteria') => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        const invalidFiles = files.filter(f => !validFileTypes.includes(f.type));
        if (invalidFiles.length > 0) {
            toast({ title: "지원하지 않는 파일 형식", description: "이미지(JPG, PNG) 또는 PDF 파일만 선택해주세요.", variant: "destructive" });
            event.target.value = '';
            return;
        }

        if (fileType === 'student') {
            // Append or replace depending on how you want the UX. Replacing is standard for normal file inputs unless customized.
            setStudentFiles(files);
        }
        if (fileType === 'criteria') {
            setCriteriaFile(files[0]);
        }
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
        if (studentFiles.length === 0) {
            toast({ title: "학생 과제물 없음", description: "분석할 학생의 과제물 파일을 하나 이상 업로드해주세요.", variant: "destructive" });
            return;
        }
        if (!criteriaFile && !criteriaText.trim()) {
            toast({ title: "채점 기준 없음", description: "텍스트 또는 파일 형태의 채점 기준을 하나 이상 입력해주세요.", variant: "destructive" });
            return;
        }
        setAnalysisState('analyzing');
        setError(null);
        setAnalysisResult(null);
        toast({ title: "AI 분석 시작", description: `[${selectedModel}] 모델을 사용하여 ${studentFiles.length}개의 과제물을 분석하고 있습니다.` });

        try {
            const studentSubmissionUris = await Promise.all(studentFiles.map(fileToDataUri));
            const criteriaFileUri = criteriaFile ? await fileToDataUri(criteriaFile) : undefined;

            const result = await analyzeHandwritingSubmission({
                studentSubmissionUris,
                criteriaFileUri,
                criteriaText: criteriaText || undefined,
                model: selectedModel,
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
        setStudentFiles([]);
        setCriteriaFile(null);
        setCriteriaText('');
        setAnalysisResult(null);
        setError(null);

        const studentInput = document.getElementById('student-upload') as HTMLInputElement;
        if (studentInput) studentInput.value = '';
        const criteriaInput = document.getElementById('criteria-upload') as HTMLInputElement;
        if (criteriaInput) criteriaInput.value = '';
    };

    const isAnalyzeButtonDisabled = useMemo(() => {
        if (studentFiles.length === 0) return true;
        if (!criteriaFile && !criteriaText.trim()) return true;
        if (analysisState === 'analyzing') return true;
        return false;
    }, [studentFiles, criteriaFile, criteriaText, analysisState]);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileUp /> 자료 업로드</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="student-upload">학생 과제물 (이미지/PDF 여러 장 가능) <span className="text-red-500">*</span></Label>
                            <Input id="student-upload" type="file" multiple accept={validFileTypes.join(',')} onChange={(e) => handleFileChange(e, 'student')} />
                            {studentFiles.length > 0 && (
                                <p className="text-xs text-muted-foreground">{studentFiles.length}개의 파일이 선택되었습니다.</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="criteria-upload">채점 기준 자료 (이미지/PDF)</Label>
                            <Input id="criteria-upload" type="file" accept={validFileTypes.join(',')} onChange={(e) => handleFileChange(e, 'criteria')} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="custom-criteria">채점 기준 (텍스트)</Label>
                        <Textarea
                            id="custom-criteria"
                            placeholder="파일 대신 텍스트로 채점 기준을 입력할 수 있습니다. 예: 1. 단어의 철자가 정확한가? 2. 문법적으로 올바른 문장을 사용했는가?"
                            value={criteriaText}
                            onChange={(e) => setCriteriaText(e.target.value)}
                            rows={3}
                        />
                        <p className="text-xs text-muted-foreground">채점 기준은 파일 또는 텍스트 중 하나 이상을 반드시 입력해야 합니다.</p>
                    </div>
                    <div>
                        <Label htmlFor="model-select" className="text-sm font-medium">AI 평가 모델 선택</Label>
                        <Select onValueChange={(value) => setSelectedModel(value as EvaluationModel)} value={selectedModel}>
                            <SelectTrigger id="model-select">
                                <SelectValue placeholder="모델을 선택하세요..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="googleai/gemini-3.6-flash">gemini-3.6-flash (빠름)</SelectItem>
                                <SelectItem value="googleai/gemini-3.1-pro-preview">gemini-3.1-pro-preview (고성능)</SelectItem>
                            </SelectContent>
                        </Select>
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
                        <AlertTriangle className="h-8 w-8 text-destructive" />
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
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex items-center gap-2 text-base"><Info className="h-4 w-4" /> 원본 스캔 결과 (Raw As-is)</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 text-sm font-mono whitespace-pre-wrap">
                                    {analysisResult.rawTranscription || "(추출된 텍스트 없음)"}
                                </CardContent>
                            </Card>
                            <Card className="bg-blue-50 dark:bg-blue-950/20 border-dashed">
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> 최종 교정본 (Polished)</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 text-sm whitespace-pre-wrap">
                                    {analysisResult.polishedText || "(교정 텍스트 없음)"}
                                </CardContent>
                            </Card>
                        </div>

                        {analysisResult.errorAnalysis && analysisResult.errorAnalysis.length > 0 && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-orange-500" /> 오탈자 및 교정 분석</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-muted text-muted-foreground">
                                                <tr>
                                                    <th className="px-4 py-2 font-medium">원본 (오타)</th>
                                                    <th className="px-4 py-2 font-medium">교정본</th>
                                                    <th className="px-4 py-2 font-medium">교정 이유</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {analysisResult.errorAnalysis.map((err: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-muted/50">
                                                        <td className="px-4 py-2 font-mono text-red-500 line-through decoration-red-500/50">{err.original}</td>
                                                        <td className="px-4 py-2 font-mono text-green-600 font-medium">{err.correction}</td>
                                                        <td className="px-4 py-2 text-muted-foreground">{err.reason}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-base"><Info className="h-4 w-4" /> 통합 피드백 (학생용)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 bg-muted/30 rounded-b-lg markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {analysisResult.studentFeedback}
                                </ReactMarkdown>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-base"><Info className="h-4 w-4" /> 교사용 지도 조언</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 bg-muted/30 rounded-b-lg whitespace-pre-wrap font-body text-sm leading-relaxed">
                                {analysisResult.teacherGuidance}
                            </CardContent>
                        </Card>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
