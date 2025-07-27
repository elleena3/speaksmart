
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SettingsPage() {
    const { t } = useLanguage();
    const { user, loading, manualLogin } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    
    const isMockUser = user?.isMock || false;

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
        } else if (user) {
            setDisplayName(user.displayName || '');
            setEmail(user.email || '');
        }
    }, [user, loading, router]);

    const handleUpdateProfile = async () => {
        if (!user || !user.docId || isMockUser) {
            toast({ title: "오류", description: "사용자 정보를 찾을 수 없거나 목업 계정은 수정할 수 없습니다.", variant: "destructive" });
            return;
        }
        
        if (!displayName.trim() || !email.trim()) {
            toast({ title: "오류", description: "이름과 이메일은 비워둘 수 없습니다.", variant: "destructive" });
            return;
        }

        setIsUpdating(true);
        try {
            if (email !== user.email) {
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("email", "==", email));
                const querySnapshot = await getDocs(q);
                
                const isTaken = querySnapshot.docs.some(doc => doc.id !== user.docId);

                if (isTaken) {
                    toast({ title: "오류", description: "이미 사용 중인 이메일입니다.", variant: "destructive" });
                    setIsUpdating(false);
                    return;
                }
            }

            const userRef = doc(db, "users", user.docId);
            await updateDoc(userRef, {
                displayName: displayName,
                email: email,
            });

            const updatedUser = { ...user, displayName, email };
            manualLogin(updatedUser);

            toast({ title: "성공", description: "프로필이 성공적으로 업데이트되었습니다." });
        } catch (error) {
            console.error("Error updating profile: ", error);
            toast({ title: "오류", description: "프로필 업데이트 중 문제가 발생했습니다.", variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading || !user) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">{t.teacherSettings.title}</h2>
            <p className="text-muted-foreground">{t.teacherSettings.description}</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>{t.teacherSettings.account.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 {isMockUser && (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            현재 목업 계정으로 로그인되어 있습니다. 목업 계정의 프로필 정보는 수정할 수 없습니다.
                        </AlertDescription>
                    </Alert>
                )}
                <div className="grid gap-2">
                    <Label htmlFor="name">{t.teacherSettings.account.nameLabel}</Label>
                    <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} readOnly={isMockUser} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email">{t.teacherSettings.account.emailLabel}</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={isMockUser} />
                </div>
                 <Button onClick={handleUpdateProfile} disabled={isUpdating || isMockUser}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    {t.teacherSettings.account.updateButton}
                 </Button>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>{t.teacherSettings.notifications.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="new-submission" className="font-medium">{t.teacherSettings.notifications.newSubmissionLabel}</Label>
                        <p className="text-sm text-muted-foreground">{t.teacherSettings.notifications.newSubmissionDescription}</p>
                    </div>
                    <Switch id="new-submission" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="feedback-received" className="font-medium">{t.teacherSettings.notifications.feedbackReceivedLabel}</Label>
                        <p className="text-sm text-muted-foreground">{t.teacherSettings.notifications.feedbackReceivedDescription}</p>
                    </div>
                    <Switch id="feedback-received" />
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
