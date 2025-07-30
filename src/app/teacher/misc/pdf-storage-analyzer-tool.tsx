"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
  FileUp,
} from "lucide-react";
import { analyzePdfFromStorage, type AnalyzePdfFromStorageOutput } from "@/ai/flows/analyze-pdf-from-storage-flow";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable } from "firebase/storage";
import { Progress } from "@/components/ui/progress";

type AnalysisState = "idle" | "uploading" | "analyzing" | "analyzed" | "error";

export function PdfStorageAnalyzerTool() {
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalyzePdfFromStorageOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: "지원하지 않는 파일 형식",
        description: "PDF 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    setPdfFile(file);
    setAnalysisState("idle");
    setAnalysisResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!pdfFile || !prompt.trim() || !user) {
      toast({
        title: "정보 부족",
        description: "PDF 파일과 분석 요구사항을 모두 입력하고 로그인했는지 확인해주세요.",
        variant: "destructive",
      });
      return;
    }

    setUploadProgress(0);
    setAnalysisResult(null);
    setError(null);
    setAnalysisState("uploading");

    const filePath = `misc-uploads/${user.uid}/pdf/${Date.now()}_${pdfFile.name}`;
    const storageRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, pdfFile);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (uploadError) => {
        console.error("Upload failed:", uploadError);
        toast({
          title: "업로드 실패",
          description: "파일을 Firebase Storage에 업로드하는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        setAnalysisState("error");
        setError("파일 업로드 실패.");
      },
      async () => {
        try {
          setAnalysisState("analyzing");
          
          toast({
            title: "업로드 완료, AI 분석 시작",
            description: "AI가 PDF 파일을 분석하고 있습니다. 파일 크기에 따라 시간이 소요될 수 있습니다.",
          });

          const result = await analyzePdfFromStorage({
            filePath: filePath,
            prompt,
          });

          setAnalysisResult(result);
          setAnalysisState("analyzed");
          toast({ title: "분석 완료", description: "AI PDF 분석이 완료되었습니다." });
        } catch (e: any) {
          console.error("PDF analysis failed:", e);
          setError(e.message || "알 수 없는 오류가 발생했습니다.");
          setAnalysisState("error");
          toast({
            title: "분석 실패",
            description: `AI 분석 중 오류가 발생했습니다: ${e.message}`,
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleReset = () => {
    setAnalysisState("idle");
    setPdfFile(null);
    setPrompt("");
    setAnalysisResult(null);
    setError(null);
    setUploadProgress(0);
    const fileInput = document.getElementById("pdf-analyzer-upload") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const isAnalyzeButtonDisabled = useMemo(
    () =>
      !pdfFile ||
      !prompt.trim() ||
      analysisState === "analyzing" ||
      analysisState === "uploading",
    [pdfFile, prompt, analysisState]
  );

  const getButtonText = () => {
    if (analysisState === "uploading") return `업로드 중... (${uploadProgress.toFixed(0)}%)`;
    if (analysisState === "analyzing") return "분석 중...";
    return "PDF 분석하기";
  };

  return (
    <CardContent className="pt-6">
      <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="pdf-analyzer-upload">PDF 파일</Label>
            <Input id="pdf-analyzer-upload" type="file" accept="application/pdf" onChange={handleFileChange} />
        </div>
        <div className="space-y-2">
            <Label htmlFor="pdf-prompt">분석 요구사항</Label>
            <Textarea
                id="pdf-prompt"
                placeholder="예: 이 논문의 핵심 주장을 3줄로 요약해줘. / 이 계약서에서 잠재적인 위험 요소가 될 수 있는 조항을 모두 찾아줘."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
            />
        </div>

        {(analysisState === "uploading" || analysisState === "analyzing") && (
            <Progress value={uploadProgress} />
        )}

        <div className="flex gap-2 pt-2">
            <Button onClick={handleAnalyze} disabled={isAnalyzeButtonDisabled} className="w-full">
                {analysisState === "uploading" || analysisState === "analyzing" ? (
                <Loader2 className="mr-2 animate-spin" />
                ) : (
                <Sparkles className="mr-2" />
                )}
                {getButtonText()}
            </Button>
            <Button onClick={handleReset} variant="outline">
                <RefreshCw className="mr-2" /> 초기화
            </Button>
        </div>

        {analysisState === "analyzing" && !analysisResult && (
            <div className="text-center p-4">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">AI가 PDF를 분석하고 있습니다. 잠시만 기다려주세요...</p>
            </div>
        )}

        {analysisState === "error" && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-1"/>
                <div>
                <h4 className="font-semibold text-destructive">오류 발생</h4>
                <p className="text-sm text-destructive/80">{error}</p>
                </div>
            </div>
        )}

        {analysisState === "analyzed" && analysisResult && (
            <div>
                <h3 className="text-lg font-semibold mb-2">AI 분석 결과</h3>
                <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed min-h-[150px]">
                  {analysisResult.analysis}
                </div>
            </div>
        )}
      </div>
    </CardContent>
  );
}
