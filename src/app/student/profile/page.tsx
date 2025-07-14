
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export default function ProfilePage() {
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
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t.studentProfile.title}</CardTitle>
        <CardDescription>{t.studentProfile.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
                <AvatarImage src={user.photoURL || ""} alt={user.displayName || "User"} data-ai-hint="person portrait"/>
                <AvatarFallback>{user.displayName?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div>
                <h3 className="text-lg font-semibold">{user.displayName}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
        </div>
        <div className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="name">{t.studentProfile.fullName}</Label>
                <Input id="name" defaultValue={user.displayName || ""} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="email">{t.studentProfile.emailAddress}</Label>
                <Input id="email" type="email" defaultValue={user.email || ""} readOnly/>
            </div>
            <Button>{t.studentProfile.saveChanges}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
