
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
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";

const formSchema = z.object({
    displayName: z.string().min(2, "이름은 2글자 이상이어야 합니다."),
    grade: z.string().nonempty("학년을 입력해주세요."),
    class: z.string().nonempty("반을 입력해주세요."),
    number: z.string().nonempty("번호를 입력해주세요."),
    email: z.string().email("올바른 이메일 형식이 아닙니다."),
    password: z.string().min(6, "비밀번호는 6자리 이상이어야 합니다."),
});

export default function SignupPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            displayName: "",
            grade: "",
            class: "",
            number: "",
            email: "",
            password: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        try {
            // Check if email already exists
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("email", "==", values.email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                toast({
                    title: "회원가입 오류",
                    description: "이미 사용 중인 이메일입니다.",
                    variant: "destructive",
                });
                setIsLoading(false);
                return;
            }

            // Add new user to 'users' collection
            await addDoc(usersRef, {
                displayName: values.displayName,
                email: values.email,
                password: values.password, // In a real app, hash this password!
                grade: values.grade,
                class: values.class,
                number: values.number,
                role: "student",
                createdAt: new Date().toISOString(),
                photoURL: `https://placehold.co/40x40.png?text=${values.displayName.charAt(0)}`,
            });
            
            toast({
                title: "회원가입 성공",
                description: "로그인 페이지로 이동합니다.",
            });

            router.push("/login");

        } catch (error) {
            console.error("Error signing up:", error);
            toast({
                title: "회원가입 오류",
                description: "알 수 없는 오류가 발생했습니다. 다시 시도해주세요.",
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
                        SpeakSmart 학생 회원가입
                    </CardTitle>
                    <CardDescription className="text-gray-500">
                        계정을 생성하여 AI 영어 말하기 평가를 시작하세요.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="grade"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>학년</FormLabel>
                                            <FormControl>
                                                <Input placeholder="1" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="class"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>반</FormLabel>
                                            <FormControl>
                                                <Input placeholder="3" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="number"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>번호</FormLabel>
                                            <FormControl>
                                                <Input placeholder="15" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="displayName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>이름</FormLabel>
                                        <FormControl>
                                            <Input placeholder="홍길동" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>이메일 (아이디)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="student@example.com" {...field} />
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
                                회원가입
                            </Button>
                        </form>
                    </Form>
                    <div className="mt-4 text-center text-sm">
                        이미 계정이 있으신가요?{" "}
                        <Link href="/login" className="font-semibold text-tangerine hover:underline">
                            로그인
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
