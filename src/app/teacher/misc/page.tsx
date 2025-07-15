
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, FileText, Link as LinkIcon, Download, Target, Mic } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { transcribeFile, type TranscriptionResult } from "@/ai/flows/transcribe-file";
import { analyzePronunciation, type PronunciationAnalysisResult } from "@/ai/flows/analyze-pronunciation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";


function FileTranscriber() {
  const [file, setFile] = useState<File | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptionResult[]>([]);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith('audio/webm') || selectedFile.type.startsWith('video/webm') || selectedFile.name.endsWith('.webm')) {
        setFile(selectedFile);
        setTranscripts([]);
      } else {
        toast({
          title: "잘못된 파일 형식",
          description: ".webm 파일만 업로드할 수 있습니다.",
          variant: "destructive",
        });
      }
    }
  };

  const handleTranscribe = async () => {
    if (!file) {
      toast({
        title: "파일 없음",
        description: "먼저 webm 파일을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsTranscribing(true);
    setTranscripts([]);
    toast({ title: "변환 시작", description: "3개 모델의 텍스트 변환을 시작합니다." });

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const results = await transcribeFile(base64Audio);
        setTranscripts(results);
        toast({ title: "변환 완료", description: "모든 모델의 변환이 완료되었습니다." });
        setIsTranscribing(false);
      };
      reader.onerror = (error) => {
        console.error("File reading error:", error);
        toast({
          title: "파일 읽기 오류",
          description: "파일을 읽는 중 문제가 발생했습니다.",
          variant: "destructive"
        });
        setIsTranscribing(false);
      }
    } catch (error: any) {
      console.error("Transcription error:", error);
      toast({
        title: "텍스트 변환 오류",
        description: error.message || "AI 분석 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      setIsTranscribing(false);
    }
  };

  return (
    <CardContent className="space-y-4 pt-6">
      <div className="grid gap-2">
        <label htmlFor="file-upload" className="text-sm font-medium">오디오 파일</label>
        <Input id="file-upload" type="file" accept="audio/webm,video/webm" onChange={handleFileChange} />
        {file && <p className="text-sm text-muted-foreground">선택된 파일: {file.name}</p>}
      </div>
      <Button onClick={handleTranscribe} disabled={isTranscribing || !file} className="w-full">
        {isTranscribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
        {isTranscribing ? "변환 중..." : "모델별 텍스트로 변환"}
      </Button>
      <div className="space-y-4">
        {isTranscribing && transcripts.length === 0 && (
            <div className="text-center p-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                <p className="mt-2 text-sm text-muted-foreground">모델들이 병렬로 변환 중입니다...</p>
            </div>
        )}
        {transcripts.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              <h3 className="text-lg font-semibold border-b pb-2">모델별 변환 결과</h3>
              {transcripts.map((result, index) => (
                <div key={index} className="grid gap-2">
                  <label htmlFor={`transcript-output-file-${index}`} className="text-sm font-medium font-mono">{result.model}</label>
                  <Textarea id={`transcript-output-file-${index}`} readOnly value={result.transcript} className="text-sm bg-muted/50" rows={3} />
                </div>
              ))}
            </div>
        )}
      </div>
    </CardContent>
  );
}

function UrlTranscriber() {
  const [url, setUrl] = useState<string>("");
  const [transcripts, setTranscripts] = useState<TranscriptionResult[]>([]);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const { toast } = useToast();

  const handleTranscribe = async () => {
    if (!url.trim()) {
      toast({
        title: "URL 없음",
        description: "먼저 webm 파일의 URL을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!url.startsWith('http') || !url.endsWith('.webm')) {
        toast({
            title: "잘못된 URL",
            description: "유효한 .webm 파일 URL을 입력해주세요 (예: https://.../audio.webm).",
            variant: "destructive",
        });
        return;
    }

    setIsTranscribing(true);
    setTranscripts([]);
    toast({ title: "변환 시작", description: "URL에서 파일을 가져와 변환을 시작합니다." });

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`파일을 가져올 수 없습니다. 상태: ${response.status}`);
      }
      const blob = await response.blob();

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const results = await transcribeFile(base64Audio);
        setTranscripts(results);
        toast({ title: "변환 완료", description: "모든 모델의 변환이 완료되었습니다." });
        setIsTranscribing(false);
      };
      reader.onerror = (error) => {
        console.error("File reading error:", error);
        toast({ title: "파일 변환 오류", description: "가져온 파일을 처리하는 중 문제가 발생했습니다.", variant: "destructive"});
        setIsTranscribing(false);
      }
    } catch (error: any) {
      console.error("Transcription error:", error);
      toast({
        title: "텍스트 변환 오류",
        description: error.message || "AI 분석 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      setIsTranscribing(false);
    }
  };

  return (
    <CardContent className="space-y-4 pt-6">
      <div className="grid gap-2">
        <label htmlFor="url-input" className="text-sm font-medium">WebM 파일 URL</label>
        <Input id="url-input" type="url" placeholder="https://example.com/audio.webm" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <Button onClick={handleTranscribe} disabled={isTranscribing} className="w-full">
        {isTranscribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        {isTranscribing ? "변환 중..." : "URL에서 모델별로 변환"}
      </Button>
       <div className="space-y-4">
        {isTranscribing && transcripts.length === 0 && (
            <div className="text-center p-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                <p className="mt-2 text-sm text-muted-foreground">모델들이 병렬로 변환 중입니다...</p>
            </div>
        )}
        {transcripts.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              <h3 className="text-lg font-semibold border-b pb-2">모델별 변환 결과</h3>
              {transcripts.map((result, index) => (
                <div key={index} className="grid gap-2">
                  <label htmlFor={`transcript-output-url-${index}`} className="text-sm font-medium font-mono">{result.model}</label>
                  <Textarea id={`transcript-output-url-${index}`} readOnly value={result.transcript} className="text-sm bg-muted/50" rows={3} />
                </div>
              ))}
            </div>
        )}
      </div>
    </CardContent>
  );
}

function PronunciationAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [analysisResults, setAnalysisResults] = useState<PronunciationAnalysisResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith('audio/webm') || selectedFile.name.endsWith('.webm')) {
        setFile(selectedFile);
        setAnalysisResults([]);
      } else {
        toast({
          title: "잘못된 파일 형식",
          description: ".webm 파일만 업로드할 수 있습니다.",
          variant: "destructive",
        });
      }
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast({ title: "파일 없음", description: "먼저 webm 파일을 선택해주세요.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResults([]);
    toast({ title: "분석 시작", description: "모델별 분석을 병렬로 시작합니다." });

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        try {
            const results = await analyzePronunciation(base64Audio);
            setAnalysisResults(results);
            toast({ title: "분석 완료", description: "모든 모델의 분석이 완료되었습니다." });
        } catch (e) {
             console.error("Pronunciation analysis error:", e);
             toast({ title: "발음 분석 오류", description: (e as Error).message || "AI 분석 중 오류가 발생했습니다.", variant: "destructive" });
        } finally {
            setIsAnalyzing(false);
        }
      };
      reader.onerror = (error) => {
        console.error("File reading error:", error);
        toast({ title: "파일 읽기 오류", description: "파일을 읽는 중 문제가 발생했습니다.", variant: "destructive" });
        setIsAnalyzing(false);
      }
    } catch (error: any) {
        console.error("Pronunciation analysis error:", error);
        toast({ title: "발음 분석 오류", description: error.message || "AI 분석 중 오류가 발생했습니다.", variant: "destructive" });
        setIsAnalyzing(false);
    }
  };

  return (
    <CardContent className="space-y-4 pt-6">
      <div className="grid gap-2">
        <label htmlFor="pronunciation-file-upload" className="text-sm font-medium">오디오 파일</label>
        <Input id="pronunciation-file-upload" type="file" accept="audio/webm" onChange={handleFileChange} />
        {file && <p className="text-sm text-muted-foreground">선택된 파일: {file.name}</p>}
      </div>
      <Button onClick={handleAnalyze} disabled={isAnalyzing || !file} className="w-full">
        {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mic className="mr-2 h-4 w-4" />}
        {isAnalyzing ? "분석 중..." : "모델별 발음 분석"}
      </Button>

      {isAnalyzing && analysisResults.length === 0 && (
        <div className="text-center p-4">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            <p className="mt-2 text-sm text-muted-foreground">AI 모델들이 병렬로 분석 중입니다...</p>
        </div>
      )}

      {analysisResults.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          <h3 className="text-lg font-semibold border-b pb-2">모델별 분석 결과</h3>
          {analysisResults.map((result, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-base font-mono">{result.model}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="w-full">
                    <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-primary">발음 점수</span>
                        <span className="text-sm font-medium text-primary">{result.pronunciationScore}%</span>
                    </div>
                    <Progress value={result.pronunciationScore} className="h-2" />
                 </div>
                 <Textarea 
                    readOnly 
                    value={result.pronunciationFeedback} 
                    rows={6}
                    className="text-sm bg-muted/50"
                 />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </CardContent>
  );
}


export default function MiscPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">기타 도구</h2>
                <p className="text-muted-foreground">AI 모델의 성능을 테스트하기 위한 간단한 도구들입니다.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileText className="h-6 w-6"/> WebM 음성-텍스트 변환 도구</CardTitle>
                        <CardDescription>
                        로컬 WebM 오디오 파일을 업로드하거나 파일 URL을 입력하여 여러 모델의 음성-텍스트 변환(STT) 결과를 비교 테스트합니다.
                        </CardDescription>
                    </CardHeader>
                    <Tabs defaultValue="upload" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="upload">
                            <Upload className="mr-2 h-4 w-4" />
                            파일 업로드
                        </TabsTrigger>
                        <TabsTrigger value="url">
                            <LinkIcon className="mr-2 h-4 w-4" />
                            URL로 변환
                        </TabsTrigger>
                        </TabsList>
                        <TabsContent value="upload">
                        <FileTranscriber />
                        </TabsContent>
                        <TabsContent value="url">
                        <UrlTranscriber />
                        </TabsContent>
                    </Tabs>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Target className="h-6 w-6"/> 영어 발음 분석 도구</CardTitle>
                        <CardDescription>
                            WebM 오디오 파일을 업로드하여 여러 AI 모델의 발음, 억양, 유창성에 대한 피드백과 점수를 비교해보세요.
                        </CardDescription>
                    </CardHeader>
                    <PronunciationAnalyzer />
                </Card>
            </div>
        </div>
    );
}
