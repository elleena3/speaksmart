
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요."),
  newPassword: z.string().min(6, "새 비밀번호는 6자리 이상이어야 합니다."),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "새 비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
});


export default function ProfilePage() {
  const { t } = useLanguage();
  const { user, loading, manualLogin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const isMockUser = user?.isMock || false;

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (!loading && !user) {
        router.push('/');
    } else if (user) {
        setDisplayName(user.displayName || '');
        setEmail(user.email || '');
    }
  }, [user, loading, router]);


  async function onPasswordChangeSubmit(values: z.infer<typeof passwordFormSchema>) {
    if (!user || !user.docId || isMockUser) return;
    
    setIsChangingPassword(true);

    try {
        const userRef = doc(db, "users", user.docId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists() || userSnap.data().password !== values.currentPassword) {
            toast({ title: "오류", description: "현재 비밀번호가 올바르지 않습니다.", variant: "destructive" });
            setIsChangingPassword(false);
            return;
        }

        await updateDoc(userRef, {
            password: values.newPassword
        });

        toast({ title: "성공", description: "비밀번호가 성공적으로 변경되었습니다." });
        passwordForm.reset();

    } catch (error) {
         console.error("Error changing password:", error);
         toast({ title: "오류", description: "비밀번호 변경 중 문제가 발생했습니다.", variant: "destructive" });
    } finally {
        setIsChangingPassword(false);
    }
  }


  if (loading || !user) {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
        <Card>
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
                        <Input id="name" defaultValue={user.displayName || ""} readOnly />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">{t.studentProfile.emailAddress}</Label>
                        <Input id="email" type="email" defaultValue={user.email || ""} readOnly/>
                    </div>
                </div>
            </CardContent>
        </Card>

        {!isMockUser && (
             <Card>
                <CardHeader>
                    <CardTitle>비밀번호 변경</CardTitle>
                    <CardDescription>계정의 비밀번호를 변경합니다.</CardDescription>
                </CardHeader>
                <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordChangeSubmit)}>
                        <CardContent className="space-y-4">
                            <FormField
                                control={passwordForm.control}
                                name="currentPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>현재 비밀번호</FormLabel>
                                        <FormControl>
                                            <Input type="password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={passwordForm.control}
                                name="newPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>새 비밀번호</FormLabel>
                                        <FormControl>
                                            <Input type="password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={passwordForm.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>새 비밀번호 확인</FormLabel>
                                        <FormControl>
                                            <Input type="password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isChangingPassword}>
                                {isChangingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                비밀번호 변경
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
             </Card>
        )}
    </div>
  );
}
