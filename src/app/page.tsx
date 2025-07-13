
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { User, GraduationCap, Globe } from "lucide-react";
import { Logo } from "@/components/icons";
import { useLanguage } from "@/context/language-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Home() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8 relative">
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

      <div className="text-center mb-12">
        <div className="flex justify-center items-center mb-4">
          <Logo className="w-16 h-16 text-primary" />
          <h1 className="text-5xl font-bold font-headline ml-4">SpeakSmart 평가도구</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          AI 기반 영어 말하기 평가 플랫폼
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card className="hover:shadow-lg transition-shadow duration-300 transform hover:-translate-y-1">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-headline">학생용</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              평가를 받고, 말하기 능력을 연습하고, 실력 향상에 도움이 되는 즉각적인 AI 피드백을 받아보세요.
            </p>
            <Link href="/student/dashboard" passHref>
              <Button className="w-full" size="lg">
                학생 대시보드로 가기
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-300 transform hover:-translate-y-1">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <User className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-headline">교사용</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              평가를 관리하고, 학생 성과를 확인하며, 교수법을 개선하기 위한 통찰력을 얻으세요.
            </p>
            <Link href="/teacher/dashboard" passHref>
              <Button className="w-full" size="lg">
                교사 대시보드로 가기
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      <footer className="mt-16 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} SpeakSmart 평가도구. 모든 권리 보유.</p>
      </footer>
    </main>
  );
}
