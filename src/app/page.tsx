
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, GraduationCap, User, Loader2, Upload, FileText, Link as LinkIcon, Download } from "lucide-react";
import { Logo } from "@/components/icons";
import { useLanguage } from "@/context/language-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { transcribeFile } from "@/ai/flows/transcribe-file";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


function FileTranscriber() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith('audio/webm') || selectedFile.type.startsWith('video/webm') || selectedFile.name.endsWith('.webm')) {
        setFile(selectedFile);
        setTranscript("");
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
    setTranscript("텍스트 변환 중...");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const result = await transcribeFile(base64Audio);
        setTranscript(result || "변환된 텍스트가 없습니다.");
      };
      reader.onerror = (error) => {
        console.error("File reading error:", error);
        toast({
          title: "파일 읽기 오류",
          description: "파일을 읽는 중 문제가 발생했습니다.",
          variant: "destructive"
        });
        setTranscript("오류: 파일을 읽을 수 없습니다.");
      }
    } catch (error: any) {
      console.error("Transcription error:", error);
      toast({
        title: "텍스트 변환 오류",
        description: error.message || "AI 분석 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      setTranscript(`오류: ${error.message}`);
    } finally {
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
        {isTranscribing ? "분석 중..." : "텍스트로 변환"}
      </Button>
      <div className="grid gap-2">
        <label htmlFor="transcript-output-file" className="text-sm font-medium">변환 결과</label>
        <Textarea id="transcript-output-file" readOnly value={transcript} placeholder="이곳에 변환된 텍스트가 표시됩니다." rows={5} />
      </div>
    </CardContent>
  );
}

function UrlTranscriber() {
  const [url, setUrl] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
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

    // A simple check for a valid URL ending with .webm
    if (!url.startsWith('http') || !url.endsWith('.webm')) {
        toast({
            title: "잘못된 URL",
            description: "유효한 .webm 파일 URL을 입력해주세요 (예: https://.../audio.webm).",
            variant: "destructive",
        });
        return;
    }

    setIsTranscribing(true);
    setTranscript("파일 다운로드 및 변환 중...");

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
        const result = await transcribeFile(base64Audio);
        setTranscript(result || "변환된 텍스트가 없습니다.");
      };
      reader.onerror = (error) => {
        console.error("File reading error:", error);
        toast({ title: "파일 변환 오류", description: "가져온 파일을 처리하는 중 문제가 발생했습니다.", variant: "destructive"});
        setTranscript("오류: 파일을 변환할 수 없습니다.");
      }
    } catch (error: any) {
      console.error("Transcription error:", error);
      toast({
        title: "텍스트 변환 오류",
        description: error.message || "AI 분석 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      setTranscript(`오류: ${error.message}`);
    } finally {
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
        {isTranscribing ? "분석 중..." : "URL에서 변환"}
      </Button>
      <div className="grid gap-2">
        <label htmlFor="transcript-output-url" className="text-sm font-medium">변환 결과</label>
        <Textarea id="transcript-output-url" readOnly value={transcript} placeholder="이곳에 변환된 텍스트가 표시됩니다." rows={5} />
      </div>
    </CardContent>
  );
}


export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { loginAs } = useAuth();
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<"student" | "teacher" | null>(null);

  const content = {
    ko: {
      title: "SpeakSmart 평가도구",
      subtitle: "AI 기반 영어 말하기 평가 플랫폼",
      studentLogin: "학생으로 시작하기",
      teacherLogin: "교사로 시작하기",
      footer: `© ${new Date().getFullYear()} SpeakSmart 평가도구. 요망진 AI 모든 권리 보유.`
    },
    en: {
      title: "SpeakSmart Assessment Tool",
      subtitle: "AI-Powered English Speaking Assessment Platform",
      studentLogin: "Start as a Student",
      teacherLogin: "Start as a Teacher",
      footer: `© ${new Date().getFullYear()} SpeakSmart Assessment Tool. Yomangjin AI All rights reserved.`
    }
  };

  const handleNavigation = (role: "student" | "teacher") => {
    setLoadingRole(role);
    loginAs(role); // Set the mock user based on role
    router.push(`/${role}/dashboard`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8 relative space-y-8">
      <div className="absolute top-4 right-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Globe className="mr-2 h-4 w-4" />
              <span>{t.language.title}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLanguage('ko')} disabled={language === 'ko'}>
              한국어
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage('en')} disabled={language === 'en'}>
              English
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="text-center">
        <div className="flex justify-center items-center mb-4">
          <Logo className="w-16 h-16 text-primary" />
          <h1 className="text-5xl font-bold font-headline ml-4">{content[language].title}</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          {content[language].subtitle}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 w-full max-w-md">
        <Button
          className="w-full"
          size="lg"
          onClick={() => handleNavigation("student")}
          disabled={!!loadingRole}
        >
          {loadingRole === "student" ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <GraduationCap className="mr-2 h-5 w-5" />
          )}
          {content[language].studentLogin}
        </Button>

        <Button
          className="w-full"
          size="lg"
          variant="secondary"
          onClick={() => handleNavigation("teacher")}
          disabled={!!loadingRole}
        >
          {loadingRole === "teacher" ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <User className="mr-2 h-5 w-5" />
          )}
          {content[language].teacherLogin}
        </Button>
      </div>

      <div className="w-full max-w-xl pt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-6 w-6"/> WebM 파일 분석 도구</CardTitle>
            <CardDescription>
              로컬 WebM 오디오 파일을 업로드하거나 파일 URL을 입력하여 음성-텍스트 변환(STT) 결과를 테스트합니다.
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
      </div>
      
      <footer className="mt-8 text-center text-muted-foreground text-sm">
        <p>{content[language].footer}</p>
      </footer>
    </main>
  );
}

    