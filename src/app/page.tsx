

"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Users, School, Loader2, KeyRound, AlertTriangle, LogIn } from "lucide-react";
import { Logo } from "@/components/icons";
import { useLanguage } from "@/context/language-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";


export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { loginAs, loading } = useAuth();
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  const handleMockLogin = (role: string) => {
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
      onClick={() => handleMockLogin(role)}
      disabled={!!loadingRole || loading}
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
          <h1 className="text-5xl font-bold font-headline ml-4">{t.mainPage.accessTitle}</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          {t.mainPage.accessDescription}
        </p>
      </div>
      
      <div className="flex gap-4">
          <Link href="/login" passHref>
             <Button size="lg"><LogIn className="mr-2"/>{t.mainPage.loginButton}</Button>
          </Link>
          <Link href="/signup" passHref>
             <Button size="lg" variant="secondary">{t.mainPage.signupButton}</Button>
          </Link>
      </div>

      <div className="w-full max-w-4xl space-y-4">
        <h2 className="text-center font-semibold text-muted-foreground">{t.mainPage.mockLoginTitle}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-full">
                            <Users className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle>{t.mainPage.studentLoginTitle}</CardTitle>
                            <CardDescription>{t.mainPage.studentLoginDescription}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <RoleButton role="student1">{t.mainPage.student1Login}</RoleButton>
                    <RoleButton role="student2">{t.mainPage.student2Login}</RoleButton>
                    <RoleButton role="student3">{t.mainPage.student3Login}</RoleButton>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                     <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-full">
                            <School className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle>{t.mainPage.teacherLoginTitle}</CardTitle>
                            <CardDescription>{t.mainPage.teacherLoginDescription}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <RoleButton role="teacher">{t.mainPage.teacherLoginButton}</RoleButton>
                </CardContent>
            </Card>
        </div>
      </div>
      
      <footer className="mt-8 text-center text-muted-foreground text-sm absolute bottom-8">
        <p>{t.mainPage.footer}</p>
      </footer>
    </main>
  );
}
