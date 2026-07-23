
"use client";

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, RefreshCw, AlertTriangle, FileUp, Info, Download, Printer } from 'lucide-react';
import { analyzeHandwritingSubmission, type AnalyzeHandwritingSubmissionOutput } from '@/ai/flows/analyze-handwriting-submission-flow';
import { getPreviousGradingResult, saveGradingResult } from '@/app/teacher/misc/handwriting-actions';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { evaluationModels, type EvaluationModel } from '@/lib/types';


type AnalysisState = 'idle' | 'analyzing' | 'analyzed' | 'error';
type BatchMode = 'single' | 'individual';

export type IndividualResult = {
    id: string;
    fileName: string;
    status: 'pending' | 'analyzing' | 'done' | 'error';
    result: AnalyzeHandwritingSubmissionOutput | null;
    error?: string;
};

const validFileTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export function HandwritingSubmissionAnalyzerTool() {
    const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
    const [batchMode, setBatchMode] = useState<BatchMode>('single');
    const [studentFiles, setStudentFiles] = useState<File[]>([]);
    const [criteriaFile, setCriteriaFile] = useState<File | null>(null);
    const [previousHistoryFile, setPreviousHistoryFile] = useState<File | null>(null);
    const [criteriaText, setCriteriaText] = useState('');

    // Global single result (for single mode)
    const [analysisResult, setAnalysisResult] = useState<AnalyzeHandwritingSubmissionOutput | null>(null);

    // Batch results (for individual mode)
    const [batchResults, setBatchResults] = useState<IndividualResult[]>([]);
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

    const fileToText = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsText(file);
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

        const hasPdf = studentFiles.some(f => f.type === 'application/pdf');
        if (hasPdf && !selectedModel.includes('gemini')) {
            toast({
                title: "오류: 지원하지 않는 파일 형식",
                description: "현재 선택하신 오픈AI(GPT) 또는 클로드(Claude) 모델은 PDF 파일 내부 분석을 지원하지 않습니다. 캡처 이미지(JPG/PNG)로 업로드하시거나, 최고급 모델인 제미나이(Google AI)를 선택해주세요.",
                variant: "destructive"
            });
            return;
        }

        setAnalysisState('analyzing');
        setError(null);
        setAnalysisResult(null);
        setBatchResults([]);

        const criteriaFileUri = criteriaFile ? await fileToDataUri(criteriaFile) : undefined;
        let uploadedHistoryContext = "";
        if (previousHistoryFile) {
            try {
                uploadedHistoryContext = await fileToText(previousHistoryFile);
            } catch (err) {
                console.error("Failed to read history CSV:", err);
            }
        }

        if (batchMode === 'single') {
            toast({ title: "AI 통합 분석 시작", description: `[${selectedModel}] 모델로 ${studentFiles.length}개의 파일을 1명의 과제물로 통합하여 분석합니다.` });
            try {
                const studentSubmissionUris = await Promise.all(studentFiles.map(fileToDataUri));

                // 1. Fetch DB auto-context if single file is uploaded
                let combinedContext = uploadedHistoryContext;
                if (studentFiles.length === 1) {
                    const dbRecord = await getPreviousGradingResult(studentFiles[0].name);
                    if (dbRecord) {
                        toast({ title: "과거 채점 내역 발견", description: "데이터베이스에서 이 학생의 과거 채점 내역을 발견하여 자동으로 2차 채점을 진행합니다." });
                        combinedContext += (combinedContext ? "\n" : "") + dbRecord;
                    }
                }

                const result = await analyzeHandwritingSubmission({
                    studentSubmissionUris,
                    criteriaFileUri,
                    criteriaText: criteriaText || undefined,
                    model: selectedModel,
                    previousGradingContext: combinedContext || undefined
                });

                // 2. Save DB auto-context (only if 1 file)
                if (studentFiles.length === 1) {
                    await saveGradingResult(studentFiles[0].name, result);
                }

                setAnalysisResult(result);
                setAnalysisState('analyzed');
                toast({ title: "분석 완료", description: "AI 과제물 분석이 완료되었습니다." });
            } catch (e: any) {
                console.error("Single Analysis failed:", e);
                setError(e.message || "알 수 없는 오류가 발생했습니다.");
                setAnalysisState('error');
                toast({ title: "분석 실패", description: `AI 분석 중 오류가 발생했습니다: ${e.message}`, variant: "destructive" });
            }
        }
        else if (batchMode === 'individual') {
            toast({ title: "AI 개별 일괄 분석 시작", description: `[${selectedModel}] 모델로 ${studentFiles.length}명의 과제물을 5명씩 병렬로 빠르게 분석합니다.` });

            // Initialize states for all files
            const initialResults: IndividualResult[] = studentFiles.map(f => ({
                id: Math.random().toString(36).substr(2, 9),
                fileName: f.name,
                status: 'pending',
                result: null
            }));
            setBatchResults(initialResults);

            let hasError = false;
            const CONCURRENT_BATCH_SIZE = 5;
            let previousGradingContext = uploadedHistoryContext;

            // Process in batches of 5 to speed up the process while avoiding severe API Rate Limits
            for (let i = 0; i < studentFiles.length; i += CONCURRENT_BATCH_SIZE) {
                const batchFiles = studentFiles.slice(i, i + CONCURRENT_BATCH_SIZE);
                const batchIndices = Array.from({ length: batchFiles.length }, (_, idx) => i + idx);

                // 1. Mark current batch as analyzing
                setBatchResults(prev => prev.map(r => {
                    const isCurrentBatch = batchIndices.some(idx => initialResults[idx].id === r.id);
                    return isCurrentBatch ? { ...r, status: 'analyzing' } : r;
                }));

                // 2. Process current batch concurrently
                const processedResults = await Promise.all(batchFiles.map(async (file, batchIndex) => {
                    const globalIndex = i + batchIndex;
                    const currentId = initialResults[globalIndex].id;

                    try {
                        const uri = await fileToDataUri(file);

                        // NEW LOGIC: Fetch previous record from DB automatically
                        const previousRecordStr = await getPreviousGradingResult(file.name);

                        let combinedContext = previousGradingContext;
                        if (previousRecordStr) {
                            combinedContext += (combinedContext ? "\n" : "") + `[자동 연동된 ${file.name}의 기록]\n${previousRecordStr}`;
                        }

                        const result = await analyzeHandwritingSubmission({
                            studentSubmissionUris: [uri], // Array of 1 URi
                            criteriaFileUri,
                            criteriaText: criteriaText || undefined,
                            model: selectedModel,
                            previousGradingContext: combinedContext || undefined
                        });

                        // NEW LOGIC: Save this result back to DB 
                        await saveGradingResult(file.name, result);

                        setBatchResults(prev => prev.map(r => r.id === currentId ? { ...r, status: 'done', result } : r));
                        return { status: 'done' as const, result };
                    } catch (e: any) {
                        console.error(`Individual Analysis failed for ${file.name}:`, e);
                        hasError = true;
                        setBatchResults(prev => prev.map(r => r.id === currentId ? { ...r, status: 'error', error: e.message } : r));
                        return { status: 'error' as const, result: null };
                    }
                }));

                // 3. Accumulate context to ensure objective grading consistency
                const successfulResults = processedResults.filter(r => r.status === 'done' && r.result);
                if (successfulResults.length > 0) {
                    const batchSummary = successfulResults
                        .map(r => `[과거 학생 표본] 부여 점수: ${r.result?.score}. 감점 사유: ${r.result?.scoringDetails}`)
                        .join("\n");

                    previousGradingContext += (previousGradingContext ? "\n" : "") + batchSummary;
                    if (previousGradingContext.length > 3000) {
                        previousGradingContext = previousGradingContext.slice(-3000);
                    }
                }
            }

            setAnalysisState('analyzed');
            if (hasError) {
                toast({ title: "일괄 분석 완료 (오류 포함)", description: "분석이 완료되었으나 일부 파일에서 오류가 발생했습니다.", variant: "destructive" });
            } else {
                toast({ title: "일괄 분석 완료", description: `${studentFiles.length}명의 과제물 분석이 모두 완료되었습니다.` });
            }
        }
    };

    const handleReset = () => {
        setAnalysisState('idle');
        setStudentFiles([]);
        setCriteriaFile(null);
        setPreviousHistoryFile(null);
        setCriteriaText('');
        setAnalysisResult(null);
        setError(null);

        const studentInput = document.getElementById('student-upload') as HTMLInputElement;
        if (studentInput) studentInput.value = '';
        const criteriaInput = document.getElementById('criteria-upload') as HTMLInputElement;
        if (criteriaInput) criteriaInput.value = '';
        const historyInput = document.getElementById('history-upload') as HTMLInputElement;
        if (historyInput) historyInput.value = '';
    };

    const isAnalyzeButtonDisabled = useMemo(() => {
        if (studentFiles.length === 0) return true;
        if (!criteriaFile && !criteriaText.trim()) return true;
        if (analysisState === 'analyzing') return true;
        return false;
    }, [studentFiles, criteriaFile, criteriaText, analysisState]);

    const handleExportCSV = () => {
        const doneResults = batchResults.filter(r => r.status === 'done' && r.result);
        if (doneResults.length === 0) {
            toast({ title: '내보낼 결과가 없습니다.', variant: 'destructive' });
            return;
        }

        // CSV Header
        let csvContent = '학생 과제물명,부여 점수,원본 스캔(As-is),최종 교정본(Polished),발견된 오탈자 수,통합 피드백(학생용),교사용 지도 조언,산출 근거\n';

        doneResults.forEach(item => {
            if (!item.result) return;
            const res = item.result;
            const fileName = item.fileName.replace(/"/g, '""');
            const score = res.score !== undefined ? res.score : '';
            const raw = (res.rawTranscription || '').replace(/"/g, '""');
            const polished = (res.polishedText || '').replace(/"/g, '""');
            const errCount = res.errorAnalysis ? res.errorAnalysis.length : 0;
            const studentFB = (res.studentFeedback || '').replace(/"/g, '""');
            const teacherGuidance = (res.teacherGuidance || '').replace(/"/g, '""');
            const scoringDetails = (res.scoringDetails || '').replace(/"/g, '""');

            // Wrapping fields with quotes to handle multiline safely in Excel
            csvContent += `"${fileName}","${score}","${raw}","${polished}","${errCount}","${studentFB}","${teacherGuidance}","${scoringDetails}"\n`;
        });

        // Add BOM so Excel opens UTF-8 properly
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `자필과제채점결과_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const generateReportHtml = (item: IndividualResult, index?: number): string => {
        if (!item.result) return '';
        const res = item.result;

        let errorsHtml = '';
        if (res.errorAnalysis && res.errorAnalysis.length > 0) {
            const tableRows = res.errorAnalysis.map(err => `
                <tr>
                    <td style="color: red; text-decoration: line-through;">${err.original}</td>
                    <td style="color: green; font-weight: bold;">${err.correction}</td>
                    <td>${err.reason}</td>
                </tr>
            `).join('');

            errorsHtml = `
                <h3>🚨 오탈자 및 교정 분석</h3>
                <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 20px;" border="1">
                    <thead>
                        <tr style="background-color: #f1f5f9;">
                            <th style="padding: 8px;">원본 (오타)</th>
                            <th style="padding: 8px;">교정본</th>
                            <th style="padding: 8px;">교정 이유</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            `;
        }

        const titlePrefix = index !== undefined ? `#${index + 1} ` : '';

        return `
            <div class="report-container">
                <h1>📝 ${titlePrefix}${item.fileName} 피드백 리포트</h1>
                <p><strong>생성일자:</strong> ${new Date().toLocaleDateString()}</p>
                
                <h3>통합 피드백 (학생용)</h3>
                <div class="box box-blue">${res.studentFeedback}</div>
                
                ${errorsHtml}
                
                <hr style="margin: 30px 0; border: 0; border-top: 1px dashed #cbd5e1;" />
                
                <h3>✅ 종합 점수 및 채점 기준</h3>
                <div class="box">
                    <p style="font-size: 18px; font-weight: bold; color: #1e40af; margin-bottom: 8px;">최종 점수: ${res.score !== undefined ? res.score : 'N/A'}</p>
                    <p>${res.scoringDetails || '채점 기준 내역이 없습니다.'}</p>
                </div>

                <h3>👩‍🏫 교사용 지도 조언 (참고용)</h3>
                <div class="box">${res.teacherGuidance}</div>
                
                <h3>원본 스캔 / 교정본 대조</h3>
                <div style="display: flex; gap: 20px;">
                    <div style="flex: 1;">
                        <h4 style="color: #64748b;">[ 원본 스캔 ]</h4>
                        <div class="box" style="font-family: monospace;">${res.rawTranscription || '(추출된 내용 없음)'}</div>
                    </div>
                    <div style="flex: 1;">
                        <h4 style="color: #64748b;">[ AI 최종 교정본 ]</h4>
                        <div class="box box-blue">${res.polishedText || '(교정본 없음)'}</div>
                    </div>
                </div>
            </div>
        `;
    };

    const getBaseHtmlWrapper = (title: string, bodyContent: string) => `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; line-height: 1.6; padding: 40px; color: #333; }
                h1 { border-bottom: 2px solid #2563eb; padding-bottom: 10px; color: #1e40af; }
                h3 { margin-top: 25px; color: #0f172a; }
                .box { background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap; font-size: 14px; }
                .box-blue { background-color: #eff6ff; border-color: #bfdbfe; }
                .page-break { page-break-after: always; }
                .report-container:last-child .page-break { display: none; }
                @media print {
                    body { padding: 0; margin: 0; }
                    .page-break { page-break-after: always; }
                }
            </style>
        </head>
        <body onload="window.print(); setTimeout(() => window.close(), 500);">
            ${bodyContent}
        </body>
        </html>
    `;

    const handlePrint = (item: IndividualResult) => {
        if (!item.result) return;
        const printWindow = window.open('', '_blank', 'width=800,height=800');
        if (!printWindow) {
            toast({ title: '팝업이 차단되었습니다.', variant: 'destructive' });
            return;
        }

        const content = generateReportHtml(item);
        printWindow.document.write(getBaseHtmlWrapper(`${item.fileName} 리포트`, content));
        printWindow.document.close();
    };

    const handlePrintAll = () => {
        const doneResults = batchResults.filter(r => r.status === 'done' && r.result);
        if (doneResults.length === 0) {
            toast({ title: '인쇄할 결과가 없습니다.', variant: 'destructive' });
            return;
        }

        const printWindow = window.open('', '_blank', 'width=800,height=800');
        if (!printWindow) {
            toast({ title: '팝업이 차단되었습니다.', variant: 'destructive' });
            return;
        }

        const allHtml = doneResults.map((item, idx) => generateReportHtml(item, idx))
            .join('<div class="page-break"></div>');

        printWindow.document.write(getBaseHtmlWrapper(`전체 학생 피드백 리포트 (${doneResults.length}명)`, allHtml));
        printWindow.document.close();
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileUp /> 자료 업로드</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">분석 모드 설정</Label>
                        <RadioGroup value={batchMode} onValueChange={(v) => setBatchMode(v as BatchMode)} className="flex flex-col gap-2">
                            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer">
                                <RadioGroupItem value="single" id="mode-single" />
                                <Label htmlFor="mode-single" className="cursor-pointer flex-1">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">1명의 다장 자료 (통합 분석)</span>
                                        <span className="text-xs text-muted-foreground font-normal">여러 장의 이미지를 '1명의 학생이 제출한 하나의 과제물'로 간주하여 이어서 분석합니다.</span>
                                    </div>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer">
                                <RadioGroupItem value="individual" id="mode-individual" />
                                <Label htmlFor="mode-individual" className="cursor-pointer flex-1">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">여러 명의 개별 자료 (일괄 개별 분석)</span>
                                        <span className="text-xs text-muted-foreground font-normal">{studentFiles.length > 0 ? `${studentFiles.length}명의 각 학생마다 독립된 채점표를 순차적으로 발행합니다.` : `여러 학생의 과제를 찍어 올리면, 파일 1개당 독립된 학생으로 채점표를 발행합니다.`}</span>
                                    </div>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="student-upload">학생 과제물 업로드 (이미지/PDF) <span className="text-red-500">*</span></Label>
                            <Input id="student-upload" type="file" multiple accept={validFileTypes.join(',')} onChange={(e) => handleFileChange(e, 'student')} />
                            {studentFiles.length > 0 && (
                                <p className="text-xs text-muted-foreground">{studentFiles.length}장의 파일이 선택되었습니다.</p>
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

                    <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-dashed">
                        <Label htmlFor="history-upload" className="text-primary font-semibold flex items-center gap-2">
                            <Sparkles className="h-4 w-4" /> 기존 채점 기록 연동 (CSV) - 일관성 및 2차 채점용
                        </Label>
                        <Input
                            id="history-upload"
                            type="file"
                            accept=".csv,.txt"
                            onChange={(e) => setPreviousHistoryFile(e.target.files?.[0] || null)}
                        />
                        <p className="text-xs text-muted-foreground">
                            이전에 다운로드한 채점 결과(CSV 형식)를 업로드하면, AI가 이전 채점 내역과 비교 분석하여 <b>일관성 있는 2차 채점 피드백</b>과 점수 변화 내역을 제공합니다.
                        </p>
                    </div>

                    <div>
                        <Label htmlFor="model-select" className="text-sm font-medium">AI 평가 모델 선택</Label>
                        <Select onValueChange={(value) => setSelectedModel(value as EvaluationModel)} value={selectedModel}>
                            <SelectTrigger id="model-select">
                                <SelectValue placeholder="모델을 선택하세요..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="openai/gpt-5.6-sol">gpt-5.6-sol (최고 성능)</SelectItem>
                                <SelectItem value="openai/gpt-5.6-terra">gpt-5.6-terra (균형)</SelectItem>
                                <SelectItem value="openai/gpt-5.6-luna">gpt-5.6-luna (가장 빠름)</SelectItem>
                                <SelectItem value="googleai/gemini-3.6-flash">gemini-3.6-flash (빠름* / PDF 특화)</SelectItem>
                                <SelectItem value="googleai/gemini-3.1-pro-preview">gemini-3.1-pro-preview (고성능* / PDF 특화)</SelectItem>
                                <SelectItem value="anthropic/claude-fable-5">claude-fable-5 (장시간 실행)</SelectItem>
                                <SelectItem value="anthropic/claude-opus-4-8">claude-opus-4-8 (엔터프라이즈)</SelectItem>
                                <SelectItem value="anthropic/claude-sonnet-5">claude-sonnet-5 (속도/지능 최상)</SelectItem>
                                <SelectItem value="anthropic/claude-haiku-4-5">claude-haiku-4-5 (가장 빠름)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-2">
                            ※ PDF 형식은 기본적으로 제미나이(Google AI) 모델에서 최적으로 구동됩니다. GPT/Claude 모델 선택 시, PDF 대신 캡처된 이미지(JPG/PNG/WebP)로 업로드하셔야 정상 분석됩니다.
                        </p>
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

            {analysisState === 'analyzed' && batchMode === 'single' && analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>AI 자필 과제 분석 결과</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex justify-between items-center bg-primary/10 p-4 rounded-lg border border-primary/20">
                            <div>
                                <h3 className="text-lg font-bold text-primary">부여된 최종 점수</h3>
                                <p className="text-sm text-primary/80 mt-1 whitespace-pre-wrap">{analysisResult.scoringDetails}</p>
                            </div>
                            <div className="text-4xl font-extrabold text-primary shrink-0 ml-4">{analysisResult.score !== undefined ? analysisResult.score : 'N/A'}</div>
                        </div>
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

            {batchMode === 'individual' && batchResults.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold tracking-tight">개별 학생 분석 현황 ({batchResults.filter(r => r.status === 'done').length}/{batchResults.length})</h3>
                        {batchResults.some(r => r.status === 'done') && (
                            <div className="flex items-center gap-3">
                                <Button variant="outline" onClick={handlePrintAll} className="gap-2 shrink-0 border-slate-200 text-slate-700 bg-white hover:bg-slate-100">
                                    <Printer className="h-4 w-4" /> 전체 인쇄 (PDF)
                                </Button>
                                <Button variant="outline" onClick={handleExportCSV} className="gap-2 shrink-0 border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hover:text-green-800">
                                    <Download className="h-4 w-4" /> CSV 엑셀 다운로드
                                </Button>
                            </div>
                        )}
                    </div>
                    {batchResults.map((item, index) => (
                        <Card key={item.id} className={item.status === 'analyzing' ? 'border-primary ring-1 ring-primary/20 shadow-md transition-all' : ''}>
                            <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm font-mono">#{index + 1}</span>
                                        {item.fileName}
                                    </CardTitle>
                                    <div className="flex items-center gap-4">
                                        {item.status === 'pending' && <span className="text-sm text-muted-foreground flex items-center gap-1">대기 중</span>}
                                        {item.status === 'analyzing' && <span className="text-sm text-primary font-medium flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> 분석 진행 중...</span>}
                                        {item.status === 'error' && <span className="text-sm text-destructive font-medium flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> 오류 발생</span>}
                                        {item.status === 'done' && (
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                                    <Sparkles className="h-4 w-4" /> 분석 완료
                                                </span>
                                                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
                                                <Button size="sm" variant="ghost" onClick={() => handlePrint(item)} className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-primary">
                                                    <Printer className="h-3.5 w-3.5" /> 인쇄 (PDF)
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {item.status === 'error' && (
                                    <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20 text-sm">
                                        {item.error}
                                    </div>
                                )}

                                {item.status === 'done' && item.result && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">원본 스캔 (As-is)</Label>
                                                <div className="p-3 bg-slate-50 dark:bg-slate-950 border rounded-md text-sm font-mono whitespace-pre-wrap">
                                                    {item.result.rawTranscription || "(추출된 텍스트 없음)"}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">최종 교정본 (Polished)</Label>
                                                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900 border rounded-md text-sm whitespace-pre-wrap">
                                                    {item.result.polishedText || "(교정 텍스트 없음)"}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-lg border border-emerald-200 dark:border-emerald-900">
                                            <div>
                                                <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400">부여 점수 및 산출 근거</h3>
                                                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1 whitespace-pre-wrap">{item.result.scoringDetails}</p>
                                            </div>
                                            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0 ml-4">{item.result.score !== undefined ? item.result.score : 'N/A'}</div>
                                        </div>

                                        {item.result.errorAnalysis && item.result.errorAnalysis.length > 0 && (
                                            <div className="space-y-2">
                                                <Label className="text-xs text-orange-500 font-semibold uppercase tracking-wider">오탈자 및 교정 분석</Label>
                                                <div className="border rounded-md overflow-hidden">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-muted text-muted-foreground">
                                                            <tr>
                                                                <th className="px-3 py-2 font-medium">원본 (오타)</th>
                                                                <th className="px-3 py-2 font-medium">교정본</th>
                                                                <th className="px-3 py-2 font-medium">교정 이유</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y">
                                                            {item.result.errorAnalysis.map((err: any, idx: number) => (
                                                                <tr key={idx}>
                                                                    <td className="px-3 py-2 font-mono text-red-500 line-through decoration-red-500/50">{err.original}</td>
                                                                    <td className="px-3 py-2 font-mono text-green-600 font-medium">{err.correction}</td>
                                                                    <td className="px-3 py-2 text-muted-foreground text-xs leading-relaxed">{err.reason}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">통합 피드백 (학생용)</Label>
                                                <div className="p-4 border rounded-md bg-white dark:bg-slate-950 markdown-content text-sm">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {item.result.studentFeedback}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">교사용 지도 조언</Label>
                                                <div className="p-4 border rounded-md bg-muted/20 text-sm whitespace-pre-wrap leading-relaxed">
                                                    {item.result.teacherGuidance}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )
            }
        </div >
    );
}
