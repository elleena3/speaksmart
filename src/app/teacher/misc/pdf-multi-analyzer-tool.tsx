"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  FileText,
  Trash2,
} from "lucide-react";
import { analyzeMultiplePdfs, type AnalyzeMultiplePdfsOutput } from "@/ai/flows/analyze-multiple-pdfs-flow";
import { Label } from "@/components/ui/label";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type AnalysisState = "idle" | "analyzing" | "analyzed" | "error";

export function PdfMultiAnalyzerTool() {
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalyzeMultiplePdfsOutput | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const pdfFiles = Array.from(selectedFiles).filter(
      (file) => file.type === "application/pdf"
    );

    if (pdfFiles.length !== selectedFiles.length) {
      toast({
        title: "지원하지 않는 파일 형식 포함",
        description: "PDF 파일만 선택해주세요. 다른 형식의 파일은 제외되었습니다.",
        variant: "destructive",
      });
    }

    setFiles(pdfFiles);
    setAnalysisState("idle");
    setAnalysisResult(null);
  };
  
  const handleRemoveFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  }

  const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (files.length === 0 || !prompt.trim()) {
      toast({
        title: "정보 부족",
        description: "하나 이상의 PDF 파일과 분석 요구사항을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setAnalysisState("analyzing");
    setAnalysisResult(null);
    toast({ title: "AI 분석 시작", description: `${files.length}개의 PDF 파일을 분석합니다.` });

    try {
      const fileInputs = await Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          dataUri: await fileToDataUri(file),
        }))
      );

      const result = await analyzeMultiplePdfs({
        files: fileInputs,
        prompt,
      });

      setAnalysisResult(result);
      setAnalysisState("analyzed");
      toast({ title: "분석 완료", description: "모든 PDF 파일 분석이 완료되었습니다." });
    } catch (e: any) {
      setAnalysisResult({ results: files.map(f => ({ fileName: f.name, error: e.message })) });
      setAnalysisState("error");
      toast({ title: "분석 실패", description: `분석 중 오류가 발생했습니다: ${e.message}`, variant: "destructive" });
    }
  };

  const handleReset = () => {
    setAnalysisState("idle");
    setFiles([]);
    setPrompt("");
    setAnalysisResult(null);
    const fileInput = document.getElementById("pdf-multi-upload") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const isAnalyzeButtonDisabled = useMemo(
    () => files.length === 0 || !prompt.trim() || analysisState === "analyzing",
    [files, prompt, analysisState]
  );

  return (
    <CardContent className="pt-6">
      <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="pdf-multi-upload">PDF 파일 (다중 선택 가능)</Label>
            <Input id="pdf-multi-upload" type="file" accept="application/pdf" onChange={handleFileChange} multiple />
        </div>
        
        {files.length > 0 && (
            <div className="space-y-2">
                <Label>선택된 파일 목록 ({files.length}개)</Label>
                <div className="p-2 border rounded-md max-h-40 overflow-y-auto space-y-1">
                    {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-sm p-1 bg-muted/50 rounded">
                            <span className="truncate">{file.name}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFile(index)}>
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="space-y-2">
            <Label htmlFor="pdf-prompt">분석 요구사항</Label>
            <Textarea
                id="pdf-prompt"
                placeholder="예: 각 논문의 핵심 주장과 사용된 연구 방법을 요약해줘."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
            />
        </div>

        <div className="flex gap-2 pt-2">
            <Button onClick={handleAnalyze} disabled={isAnalyzeButtonDisabled} className="w-full">
                {analysisState === "analyzing" ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}
                {analysisState === "analyzing" ? "분석 중..." : "PDF 분석하기"}
            </Button>
            <Button onClick={handleReset} variant="outline">
                <RefreshCw className="mr-2" /> 초기화
            </Button>
        </div>

        {analysisState === "analyzing" && (
            <div className="text-center p-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">AI가 PDF 파일들을 분석하고 있습니다...</p>
            </div>
        )}

        {(analysisState === "analyzed" || analysisState === "error") && analysisResult && (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 pt-4">개별 분석 결과</h3>
                {analysisResult.results.map((result, index) => (
                    <Card key={index}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <FileText className="h-5 w-5"/>
                                {result.fileName}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {result.error ? (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-1"/>
                                    <p className="text-sm text-destructive">{result.error}</p>
                                </div>
                            ) : (
                                <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed markdown-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {result.analysis || "분석 내용이 없습니다."}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}
      </div>
    </CardContent>
  );
}
