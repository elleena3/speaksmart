
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, GraduationCap, User, Loader2 } from "lucide-react";
import { Logo } from "@/components/icons";
import { useLanguage } from "@/context/language-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";


export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { loginAs } = useAuth();
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  const content = {
    ko: {
      title: "SpeakSmart 평가도구",
      subtitle: "AI 기반 영어 말하기 평가 플랫폼",
      student1Login: "학생1로 시작하기",
      student2Login: "학생2로 시작하기",
      student3Login: "학생3으로 시작하기",
      teacherLogin: "교사로 시작하기",
      footer: `© ${new Date().getFullYear()} SpeakSmart 평가도구. 요망진 AI 모든 권리 보유.`
    },
    en: {
      title: "SpeakSmart Assessment Tool",
      subtitle: "AI-Powered English Speaking Assessment Platform",
      student1Login: "Start as Student 1",
      student2Login: "Start as Student 2",
      student3Login: "Start as Student 3",
      teacherLogin: "Start as a Teacher",
      footer: `© ${new Date().getFullYear()} SpeakSmart Assessment Tool. Yomangjin AI All rights reserved.`
    }
  };

  const handleNavigation = (role: string) => {
    setLoadingRole(role);
    loginAs(role as any); 
    if(role === 'teacher') {
      router.push(`/teacher/dashboard`);
    } else {
      router.push(`/student/dashboard`);
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

      <div className="flex flex-col md:flex-row gap-4 w-full max-w-lg">
        <div className="flex flex-col gap-2 w-full">
            <Button
              className="w-full"
              size="lg"
              onClick={() => handleNavigation("student1")}
              disabled={!!loadingRole}
            >
              {loadingRole === "student1" ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <GraduationCap className="mr-2 h-5 w-5" />
              )}
              {content[language].student1Login}
            </Button>
            <Button
              className="w-full"
              size="lg"
              onClick={() => handleNavigation("student2")}
              disabled={!!loadingRole}
            >
              {loadingRole === "student2" ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <GraduationCap className="mr-2 h-5 w-5" />
              )}
              {content[language].student2Login}
            </Button>
            <Button
              className="w-full"
              size="lg"
              onClick={() => handleNavigation("student3")}
              disabled={!!loadingRole}
            >
              {loadingRole === "student3" ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <GraduationCap className="mr-2 h-5 w-5" />
              )}
              {content[language].student3Login}
            </Button>
        </div>

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
      
      <footer className="mt-8 text-center text-muted-foreground text-sm absolute bottom-8">
        <p>{content[language].footer}</p>
      </footer>
    </main>
  );
}
