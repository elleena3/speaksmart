
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Users, School, Loader2, KeyRound, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/icons";
import { useLanguage } from "@/context/language-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useAuth, SEED_TEACHER_NAME } from "@/context/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { loginAs, login, loading, user } = useAuth();
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [teacherPassword, setTeacherPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  // 목업 계정 메뉴는 비밀번호를 확인한 뒤에만 열립니다.
  // 별도 플래그를 저장하는 대신 로그인 상태를 기준으로 삼습니다.
  // 잠금 해제는 곧 교사 로그인이므로, 세션이 살아 있는 동안 새로고침해도 유지되고
  // 로그아웃하면 자연스럽게 다시 잠깁니다. (조작 가능한 플래그를 남기지 않는 이점도 있습니다.)
  const [unlockedByPassword, setUnlockedByPassword] = useState(false);
  const unlocked = unlockedByPassword || !!user;
  const [gateOpen, setGateOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleMockLogin = async (role: string) => {
    setLoadingRole(role);
    try {
      // 시드 학생 계정으로 실제 Firebase Auth 로그인을 수행합니다.
      await loginAs(role as any);
      router.push(`/student/dashboard`);
    } catch (error) {
      console.error('시드 계정 로그인 실패:', error);
      setPasswordError('시드 계정이 아직 생성되지 않았습니다. npm run seed 를 먼저 실행하세요.');
      setLoadingRole(null);
    }
  };

  /**
   * 목업 계정 메뉴를 열기 전 비밀번호를 확인합니다.
   *
   * 비밀번호를 코드에 두고 문자열로 비교하면 클라이언트 번들에서 그대로 읽힙니다.
   * 입력값으로 교사 계정 로그인을 시도해 Firebase Auth 가 대신 검증하게 하면,
   * 앱 어디에도 비밀번호를 두지 않고 같은 값을 쓸 수 있습니다.
   */
  const handleUnlock = async () => {
    setPasswordError('');
    setIsUnlocking(true);
    try {
      await login(SEED_TEACHER_NAME, teacherPassword);
      setUnlockedByPassword(true);
      setGateOpen(false);
      setTeacherPassword('');
      setMenuOpen(true);
    } catch (error) {
      setPasswordError('비밀번호가 올바르지 않습니다.');
    } finally {
      setIsUnlocking(false);
    }
  };

  // 잠금이 풀리기 전에는 메뉴 대신 비밀번호 창을 띄웁니다.
  const handleMenuOpenChange = (open: boolean) => {
    if (open && !unlocked) {
      setGateOpen(true);
      return;
    }
    setMenuOpen(open);
  };

  const onGateOpenChange = (open: boolean) => {
    setGateOpen(open);
    if (!open) {
      setTeacherPassword('');
      setPasswordError('');
    }
  };

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

        <Dialog open={gateOpen} onOpenChange={onGateOpenChange}>
            <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-white/70">
                <Users className="mr-2 h-4 w-4" />
                <span>{t.mainPage.mockLoginTitle}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>교사</DropdownMenuLabel>
                {/* 잠금 해제 과정에서 이미 교사로 로그인된 상태이므로 바로 이동합니다. */}
                <DropdownMenuItem onClick={() => router.push('/teacher/dashboard')}>
                    <School className="mr-2 h-4 w-4" />
                    교사로 로그인
                </DropdownMenuItem>
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
                    <DialogTitle>빠른 테스트 계정</DialogTitle>
                    <DialogDescription>
                        테스트 계정을 사용하려면 교사 계정 비밀번호를 입력하세요.
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
                                    void handleUnlock();
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
                        <Button type="button" variant="secondary">취소</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleUnlock} disabled={isUnlocking || !teacherPassword}>
                        {isUnlocking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        확인
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
