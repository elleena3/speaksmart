
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function SettingsPage() {
    const { t } = useLanguage();
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if(!loading && !user) {
            router.push('/');
        }
    }, [user, loading, router]);

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
                <div className="grid gap-2">
                    <Label htmlFor="name">{t.teacherSettings.account.nameLabel}</Label>
                    <Input id="name" defaultValue={user.displayName || ''} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email">{t.teacherSettings.account.emailLabel}</Label>
                    <Input id="email" type="email" defaultValue={user.email || ''} readOnly />
                </div>
                 <Button>{t.teacherSettings.account.updateButton}</Button>
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
