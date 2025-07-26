
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { KeyRound, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/language-context";
import Link from 'next/link';

// This page now only serves as a gateway to the individual tool pages
// to avoid confusion and keep the codebase clean. The tools themselves
// are now located in /lab and /components/feature-tools
export default function MiscPage() {
    const { t } = useLanguage();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === '2918') {
            setIsAuthenticated(true);
            setError('');
        } else {
            setError(t.teacherMisc.incorrectPasswordError);
            setPassword('');
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Card className="w-full max-w-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <KeyRound className="h-6 w-6"/> {t.teacherMisc.accessTitle}
                        </CardTitle>
                        <CardDescription>
                            {t.teacherMisc.accessDescription}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t.teacherMisc.passwordPlaceholder}
                                autoFocus
                            />
                            {error && (
                                <div className="flex items-center text-sm font-medium text-destructive">
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    {error}
                                </div>
                            )}
                            <Button type="submit" className="w-full">
                                {t.teacherMisc.confirmButton}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">{t.teacherMisc.title}</h2>
                <p className="text-muted-foreground">{t.teacherMisc.description}</p>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>AI 기능 실험실 바로가기</CardTitle>
                    <CardDescription>이제 모든 실험적 기능은 로그인 없이 접근 가능한 '실험실' 페이지에서 테스트할 수 있습니다. 아래 버튼을 클릭하여 이동하세요.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Link href="/lab" passHref>
                        <Button>실험실로 이동</Button>
                    </Link>
                </CardContent>
             </Card>
        </div>
    );
}
