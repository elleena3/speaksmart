
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, GraduationCap, User, Loader2, Upload } from "lucide-react";
import { Logo } from "@/components/icons";
import { useLanguage } from "@/context/language-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { loginAs } = useAuth();
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<"student" | "teacher" | null>(null);

  // For file upload test
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();


  const content = {
    ko: {
      title: "SpeakSmart 평가도구",
      subtitle: "AI 기반 영어 말하기 평가 플랫폼",
      studentLogin: "학생으로 시작하기",
      teacherLogin: "교사로 시작하기",
      footer: `© ${new Date().getFullYear()} SpeakSmart 평가도구. 모든 권리 보유.`
    },
    en: {
      title: "SpeakSmart Assessment Tool",
      subtitle: "AI-Powered English Speaking Assessment Platform",
      studentLogin: "Start as a Student",
      teacherLogin: "Start as a Teacher",
      footer: `© ${new Date().getFullYear()} SpeakSmart Assessment Tool. All rights reserved.`
    }
  };

  const handleNavigation = (role: "student" | "teacher") => {
    setLoadingRole(role);
    loginAs(role); // Set the mock user based on role
    router.push(`/${role}/dashboard`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadTest = async () => {
    if (!file) {
      toast({
        title: "파일 없음",
        description: "먼저 테스트할 파일을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    setIsUploading(true);
    toast({
      title: "업로드 중...",
      description: `파일: ${file.name}`,
    });
    try {
      const storageRef = ref(storage, `test-uploads/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      toast({
        title: "업로드 완료!",
        description: "파일이 Firebase Storage에 성공적으로 업로드되었습니다.",
      });
      setFile(null);
    } catch (error) {
      console.error("Upload test error:", error);
      toast({
        title: "업로드 실패",
        description: "파일 업로드 중 오류가 발생했습니다. 콘솔을 확인해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
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
      
      {/* File Upload Test Section */}
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>스토리지 업로드 테스트</CardTitle>
          <CardDescription>Firebase Storage 연결을 테스트하려면 아무 파일이나 업로드해보세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Input type="file" onChange={handleFileChange} />
            <Button onClick={handleUploadTest} disabled={isUploading || !file} className="w-full">
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {isUploading ? "업로드 중..." : "업로드 테스트"}
            </Button>
        </CardContent>
      </Card>

      <footer className="mt-8 text-center text-muted-foreground text-sm">
        <p>{content[language].footer}</p>
      </footer>
    </main>
  );
}
