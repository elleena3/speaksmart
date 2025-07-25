
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { type UserData } from "@/lib/types";

const formSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export default function LoginPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { manualLogin } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            password: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        if (!db) {
            toast({
                title: "설정 오류",
                description: "Firebase 데이터베이스가 설정되지 않았습니다. 관리자에게 문의하세요.",
                variant: "destructive",
            });
            setIsLoading(false);
            return;
        }

        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("displayName", "==", values.name), where("password", "==", values.password));
            
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({
                    title: "로그인 실패",
                    description: "이름(아이디) 또는 비밀번호가 일치하지 않습니다.",
                    variant: "destructive",
                });
                setIsLoading(false);
                return;
            }
            
            // Login successful
            const userDoc = querySnapshot.docs[0];
            const userData = { uid: userDoc.id, ...userDoc.data() } as UserData;
            
            manualLogin(userData);

            toast({
                title: "로그인 성공!",
                description: `${userData.displayName}님, 환영합니다.`,
            });
            
            if (userData.role === 'teacher') {
                router.push('/teacher/dashboard');
            } else {
                router.push('/student/dashboard');
            }

        } catch (error) {
            console.error("Error logging in:", error);
            toast({
                title: "로그인 오류",
                description: "알 수 없는 오류가 발생했습니다.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-saebyeol-beige p-8">
            <Card className="w-full max-w-md bg-white/70 shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold text-basalt-gray">
                        SpeakSmart 로그인
                    </CardTitle>
                    <CardDescription className="text-gray-500">
                        계정에 로그인하여 맞춤형 학습을 시작하세요.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>이름 (아이디)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="홍길동" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>비밀번호</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="******" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full bg-jeju-sea hover:bg-jeju-sea/90" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                로그인
                            </Button>
                        </form>
                    </Form>
                     <div className="mt-4 text-center text-sm">
                        계정이 없으신가요?{" "}
                        <Link href="/signup" className="font-semibold text-tangerine hover:underline">
                            회원가입
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
