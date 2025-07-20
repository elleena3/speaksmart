
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Users, School, Loader2, KeyRound, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/icons";
import { useLanguage } from "@/context/language-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";


export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { loginAs } = useAuth();
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const content = {
    ko: {
      title: "SpeakSmart 평가도구",
      subtitle: "AI 기반 영어 말하기 평가 플랫폼",
      studentLoginTitle: "학생으로 시작하기",
      studentLoginDescription: "목업 학생 계정을 선택하여 시작하세요.",
      student1Login: "학생 1",
      student2Login: "학생 2",
      student3Login: "학생 3",
      teacherLoginTitle: "교사로 시작하기",
      teacherLoginDescription: "교사 대시보드 및 평가 관리 도구에 접근합니다.",
      teacherLoginButton: "교사로 시작하기",
      footer: `© ${new Date().getFullYear()} SpeakSmart 평가도구. 요망진 AI 모든 권리 보유.`
    },
    en: {
      title: "SpeakSmart Assessment Tool",
      subtitle: "AI-Powered English Speaking Assessment Platform",
      studentLoginTitle: "Start as a Student",
      studentLoginDescription: "Select a mock student account to begin.",
      student1Login: "Student 1",
      student2Login: "Student 2",
      student3Login: "Student 3",
      teacherLoginTitle: "Start as a Teacher",
      teacherLoginDescription: "Access the teacher dashboard and assessment management tools.",
      teacherLoginButton: "Start as a Teacher",
      footer: `© ${new Date().getFullYear()} SpeakSmart Assessment Tool. Yomangjin AI All rights reserved.`
    }
  };
  
  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (password === '0918') {
          setIsAuthenticated(true);
          setError('');
      } else {
          setError(t.mainPage.incorrectPasswordError);
          setPassword('');
      }
  };


  if (!isAuthenticated) {
      return (
           <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 md:p-8 relative">
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
                <Card className="w-full max-w-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <KeyRound className="h-6 w-6"/> {t.mainPage.accessTitle}
                        </CardTitle>
                        <CardDescription>
                           {t.mainPage.accessDescription}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t.mainPage.passwordPlaceholder}
                                autoFocus
                            />
                            {error && (
                                <div className="flex items-center text-sm font-medium text-destructive">
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    {error}
                                </div>
                            )}
                            <Button type="submit" className="w-full">
                                {t.mainPage.confirmButton}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
           </main>
      )
  }

  const handleNavigation = (role: string) => {
    setLoadingRole(role);
    loginAs(role as any); 
    if(role === 'teacher') {
      router.push(`/teacher/dashboard`);
    } else {
      router.push(`/student/dashboard`);
    }
  };
  
  const RoleButton = ({ role, children }: { role: string; children: React.ReactNode }) => (
    <Button
      className="w-full"
      size="lg"
      onClick={() => handleNavigation(role)}
      disabled={!!loadingRole}
    >
      {loadingRole === role ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : children}
    </Button>
  );


  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 md:p-8 relative space-y-8">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-full">
                        <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <CardTitle>{content[language].studentLoginTitle}</CardTitle>
                        <CardDescription>{content[language].studentLoginDescription}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <RoleButton role="student1">{content[language].student1Login}</RoleButton>
                <RoleButton role="student2">{content[language].student2Login}</RoleButton>
                <RoleButton role="student3">{content[language].student3Login}</RoleButton>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                 <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-full">
                        <School className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <CardTitle>{content[language].teacherLoginTitle}</CardTitle>
                        <CardDescription>{content[language].teacherLoginDescription}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <RoleButton role="teacher">{content[language].teacherLoginButton}</RoleButton>
            </CardContent>
        </Card>
      </div>
      
      <footer className="mt-8 text-center text-muted-foreground text-sm absolute bottom-8">
        <p>{content[language].footer}</p>
      </footer>
    </main>
  );
}
