"use client";

import { useState, useMemo, useCallback } from "react";
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
  CircleDashed,
  CheckCircle2
} from "lucide-react";
import { analyzeSinglePdf, type SingleFileAnalysisResult } from "@/ai/flows/analyze-multiple-pdfs-flow";
import { Label } from "@/components/ui/label";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type FileStatus = "pending" | "analyzing" | "analyzed" | "error";
type FileWithStatus = {
  file: File;
  status: FileStatus;
  result?: SingleFileAnalysisResult;
  id: string;
};

export function PdfSequentialAnalyzerTool() {
  const [filesWithStatus, setFilesWithStatus] = useState<FileWithStatus[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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

    setFilesWithStatus(pdfFiles.map(file => ({
      file,
      status: 'pending',
      id: `${file.name}-${file.lastModified}`
    })));
  };
  
  const handleRemoveFile = (idToRemove: string) => {
    setFilesWithStatus(prev => prev.filter((fw) => fw.id !== idToRemove));
  };

  const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (filesWithStatus.length === 0 || !prompt.trim()) {
      toast({
        title: "정보 부족",
        description: "하나 이상의 PDF 파일과 분석 요구사항을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    toast({ title: "AI 순차 분석 시작", description: `${filesWithStatus.length}개의 PDF 파일을 순차적으로 분석합니다.` });

    const analysisPromises = filesWithStatus.map(async (fw) => {
      // Set status to analyzing for this specific file
      setFilesWithStatus(prev => prev.map(f => f.id === fw.id ? { ...f, status: 'analyzing' } : f));
      
      const dataUri = await fileToDataUri(fw.file);
      const result = await analyzeSinglePdf({
        fileName: fw.file.name,
        dataUri,
        prompt,
      });

      // Update status and result for this specific file
      setFilesWithStatus(prev => prev.map(f => f.id === fw.id ? { ...f, status: result.error ? 'error' : 'analyzed', result } : f));
      return result;
    });

    await Promise.all(analysisPromises);
    
    setIsAnalyzing(false);
    toast({ title: "모든 분석 완료", description: "모든 PDF 파일 분석이 완료되었습니다." });
  };

  const handleReset = () => {
    setIsAnalyzing(false);
    setFilesWithStatus([]);
    setPrompt("");
    const fileInput = document.getElementById("pdf-seq-upload") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };
  
  const isAnalyzeButtonDisabled = useMemo(
    () => filesWithStatus.length === 0 || !prompt.trim() || isAnalyzing,
    [filesWithStatus, prompt, isAnalyzing]
  );

  return (
    <CardContent className="pt-6">
      <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="pdf-seq-upload">PDF 파일 (다중 선택 가능)</Label>
            <Input id="pdf-seq-upload" type="file" accept="application/pdf" onChange={handleFileChange} multiple disabled={isAnalyzing}/>
        </div>
        
        <div className="space-y-2">
            <Label htmlFor="pdf-prompt-seq">분석 요구사항</Label>
            <Textarea
                id="pdf-prompt-seq"
                placeholder="예: 각 논문의 핵심 주장과 사용된 연구 방법을 요약해줘."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                disabled={isAnalyzing}
            />
        </div>

        <div className="flex gap-2 pt-2">
            <Button onClick={handleAnalyze} disabled={isAnalyzeButtonDisabled} className="w-full">
                {isAnalyzing ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}
                {isAnalyzing ? "분석 중..." : "PDF 순차 분석"}
            </Button>
            <Button onClick={handleReset} variant="outline" disabled={isAnalyzing}>
                <RefreshCw className="mr-2" /> 초기화
            </Button>
        </div>

        {filesWithStatus.length > 0 && (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 pt-4">개별 분석 결과</h3>
                {filesWithStatus.map((fw) => (
                    <Card key={fw.id}>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between text-base">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-5 w-5"/>
                                  {fw.file.name}
                                </div>
                                <div className="flex items-center gap-2">
                                  {fw.status === 'pending' && <span className="text-xs text-muted-foreground flex items-center gap-1"><CircleDashed className="h-4 w-4"/>대기중</span>}
                                  {fw.status === 'analyzing' && <span className="text-xs text-blue-500 flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin"/>분석중</span>}
                                  {fw.status === 'analyzed' && <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 className="h-4 w-4"/>완료</span>}
                                  {fw.status === 'error' && <span className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="h-4 w-4"/>오류</span>}
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFile(fw.id)} disabled={isAnalyzing}>
                                      <Trash2 className="h-4 w-4"/>
                                  </Button>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        {fw.result && (
                            <CardContent>
                                {fw.result.error ? (
                                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                                        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-1"/>
                                        <p className="text-sm text-destructive">{fw.result.error}</p>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed markdown-content">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {fw.result.analysis || "분석 내용이 없습니다."}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </CardContent>
                        )}
                    </Card>
                ))}
            </div>
        )}
      </div>
    </CardContent>
  );
}
