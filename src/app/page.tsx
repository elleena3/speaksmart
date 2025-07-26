
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Users, School, Loader2, KeyRound, AlertCircle } from "lucide-react";
import { Logo } from "@/components/icons";
import { useLanguage } from "@/context/language-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";


export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { loginAs, loading } = useAuth();
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false);
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

  const handleTeacherLoginAttempt = () => {
    if (teacherPassword === '2918') {
        setPasswordError('');
        setIsTeacherDialogOpen(false);
        handleMockLogin('teacher');
    } else {
        setPasswordError('비밀번호가 올바르지 않습니다.');
    }
  }
  
  const RoleButton = ({ role, children }: { role: string; children: React.ReactNode }) => (
    <Button
      className="w-full bg-white hover:bg-gray-100 text-basalt-gray border-gray-300"
      variant="outline"
      size="lg"
      onClick={() => handleMockLogin(role)}
      disabled={!!loadingRole || loading}
    >
      {loadingRole === role ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : children}
    </Button>
  );


  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-saebyeol-beige p-4 md:p-8 relative space-y-8">
      <div className="absolute top-4 right-4">
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
      
      <div className="w-full max-w-4xl space-y-4">
        <h2 className="text-center font-semibold text-gray-500">{t.mainPage.mockLoginTitle}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="bg-white/70 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-jeju-sea/10 rounded-full">
                            <Users className="h-6 w-6 text-jeju-sea" />
                        </div>
                        <div>
                            <CardTitle className="text-basalt-gray">{t.mainPage.studentLoginTitle}</CardTitle>
                            <CardDescription className="text-gray-500">{t.mainPage.studentLoginDescription}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <RoleButton role="student1">{t.mainPage.student1Login}</RoleButton>
                    <RoleButton role="student2">{t.mainPage.student2Login}</RoleButton>
                    <RoleButton role="student3">{t.mainPage.student3Login}</RoleButton>
                </CardContent>
            </Card>
            
            <Dialog open={isTeacherDialogOpen} onOpenChange={setIsTeacherDialogOpen}>
                <Card className="bg-white/70 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-jeju-sea/10 rounded-full">
                                <School className="h-6 w-6 text-jeju-sea" />
                            </div>
                            <div>
                                <CardTitle className="text-basalt-gray">{t.mainPage.teacherLoginTitle}</CardTitle>
                                <CardDescription className="text-gray-500">{t.mainPage.teacherLoginDescription}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <DialogTrigger asChild>
                            <Button
                                className="w-full bg-white hover:bg-gray-100 text-basalt-gray border-gray-300"
                                variant="outline"
                                size="lg"
                                disabled={!!loadingRole || loading}
                            >
                                {loadingRole === 'teacher' ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                ) : (
                                t.mainPage.teacherLoginButton
                                )}
                            </Button>
                        </DialogTrigger>
                    </CardContent>
                </Card>
                 <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><KeyRound/>교사 확인</DialogTitle>
                        <DialogDescription>
                            교사 포털에 접근하려면 비밀번호를 입력하세요.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                       <Input
                            id="password"
                            type="password"
                            value={teacherPassword}
                            onChange={(e) => setTeacherPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleTeacherLoginAttempt();
                                }
                            }}
                            placeholder="비밀번호"
                            autoFocus
                        />
                        {passwordError && (
                            <div className="flex items-center text-sm font-medium text-destructive">
                                <AlertCircle className="h-4 w-4 mr-2" />
                                {passwordError}
                            </div>
                        )}
                    </div>
                     <Button type="submit" onClick={handleTeacherLoginAttempt}>확인</Button>
                </DialogContent>
            </Dialog>
        </div>
      </div>

       <div className="text-center text-sm text-basalt-gray">
          <p>
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="font-semibold text-tangerine hover:underline">
              로그인
            </Link>
          </p>
          <p className="mt-1">
            계정이 없으신가요?{' '}
            <Link href="/signup" className="font-semibold text-tangerine hover:underline">
              학생으로 회원가입
            </Link>
          </p>
        </div>
      
      <footer className="mt-8 text-center text-gray-500 text-sm absolute bottom-8">
        <p>{t.mainPage.footer}</p>
      </footer>
    </main>
  );
}
