
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Users, School, Loader2, KeyRound, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/icons";
import { useLanguage } from "@/context/language-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { loginAs, loading } = useAuth();
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [teacherPassword, setTeacherPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleMockLogin = (role: string) => {
    setLoadingRole(role);
    loginAs(role as any); 
    if(role === 'teacher') {
      router.push(`/teacher/dashboard`);
    } else {
      router.push(`/student/dashboard`);
    }
  };

  const handleTeacherLoginAttempt = (e: React.MouseEvent) => {
    e.preventDefault();
    if (teacherPassword === '2918') {
      setPasswordError('');
      document.getElementById('teacher-login-dialog-close')?.click();
      handleMockLogin('teacher');
    } else {
      setPasswordError('비밀번호가 올바르지 않습니다.');
    }
  };

  const onTeacherDialogChange = (open: boolean) => {
    if (!open) {
        setTeacherPassword('');
        setPasswordError('');
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-saebyeol-beige p-4 md:p-8 relative space-y-8">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="bg-white/70">
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

        <Dialog onOpenChange={onTeacherDialogChange}>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-white/70">
                <Users className="mr-2 h-4 w-4" />
                <span>{t.mainPage.mockLoginTitle}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>교사</DropdownMenuLabel>
                 <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <School className="mr-2 h-4 w-4" />
                        교사로 로그인
                    </DropdownMenuItem>
                 </DialogTrigger>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>학생</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleMockLogin('student1')} disabled={!!loadingRole}>
                    {loadingRole === 'student1' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Users className="mr-2 h-4 w-4" />}
                    {t.mainPage.student1Login}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMockLogin('student2')} disabled={!!loadingRole}>
                    {loadingRole === 'student2' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Users className="mr-2 h-4 w-4" />}
                    {t.mainPage.student2Login}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMockLogin('student3')} disabled={!!loadingRole}>
                    {loadingRole === 'student3' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Users className="mr-2 h-4 w-4" />}
                    {t.mainPage.student3Login}
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
            <DialogContent className="sm:max-w-md">
                 <DialogHeader>
                    <DialogTitle>교사 로그인</DialogTitle>
                    <DialogDescription>
                        교사 목업 계정에 접근하려면 비밀번호를 입력하세요.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="teacher-password">비밀번호</Label>
                        <Input
                            id="teacher-password"
                            type="password"
                            value={teacherPassword}
                            onChange={(e) => setTeacherPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleTeacherLoginAttempt(e as any);
                                }
                            }}
                            autoFocus
                        />
                         {passwordError && (
                            <div className="flex items-center text-sm font-medium text-destructive">
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                {passwordError}
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" id="teacher-login-dialog-close">취소</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleTeacherLoginAttempt}>
                        로그인
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>

      <div className="text-center">
        <div className="flex justify-center items-center mb-4">
          <Logo className="w-16 h-16 text-jeju-sea" />
          <h1 className="text-5xl font-bold font-headline text-basalt-gray ml-4">{t.mainPage.accessTitle}</h1>
        </div>
        <p className="text-xl text-gray-500">
          {t.mainPage.accessDescription}
        </p>
      </div>
      
       <Card className="w-full max-w-sm bg-white/70 backdrop-blur-sm shadow-lg">
        <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">시작하기</CardTitle>
            <CardDescription>계정에 로그인하거나 새로 가입하세요.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
            <Link href="/login" passHref>
                <Button className="w-full" size="lg">
                    {t.mainPage.loginButton}
                </Button>
            </Link>
            <Link href="/signup" passHref>
                <Button className="w-full" size="lg" variant="outline">
                    {t.mainPage.signupButton}
                </Button>
            </Link>
        </CardContent>
      </Card>
      
      <footer className="mt-8 text-center text-gray-500 text-sm absolute bottom-8">
        <p>{t.mainPage.footer}</p>
      </footer>
    </main>
  );
}
