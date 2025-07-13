
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/context/language-context';

export default function ProfilePage() {
  const { t } = useLanguage();
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t.studentProfile.title}</CardTitle>
        <CardDescription>{t.studentProfile.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
                <AvatarImage src="https://placehold.co/80x80.png" alt="User" data-ai-hint="person portrait"/>
                <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <div>
                <h3 className="text-lg font-semibold">Alex Doe</h3>
                <p className="text-sm text-muted-foreground">alex.doe@example.com</p>
            </div>
        </div>
        <div className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="name">{t.studentProfile.fullName}</Label>
                <Input id="name" defaultValue="Alex Doe" />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="email">{t.studentProfile.emailAddress}</Label>
                <Input id="email" type="email" defaultValue="alex.doe@example.com" />
            </div>
            <Button>{t.studentProfile.saveChanges}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
