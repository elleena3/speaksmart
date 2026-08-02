
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
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { deriveAuthEmail, normalizeLoginName } from "@/lib/auth-email";

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

        const displayName = normalizeLoginName(values.displayName);

        try {
            // 이름 중복 검사는 Firestore 조회 대신 Auth가 대신합니다.
            // 같은 이름은 항상 같은 로그인 주소로 변환되므로,
            // 이미 존재하면 auth/email-already-in-use가 발생합니다.
            const credential = await createUserWithEmailAndPassword(
                auth,
                deriveAuthEmail(displayName),
                values.password
            );

            try {
                // 문서 ID를 Auth UID와 동일하게 맞춰야 보안 규칙에서 본인 확인이 가능합니다.
                await setDoc(doc(db, "users", credential.user.uid), {
                    uid: credential.user.uid,
                    displayName,
                    email: values.email,
                    grade: values.grade,
                    class: values.class,
                    number: values.number,
                    role: "student",
                    createdAt: Date.now(),
                    photoURL: `https://placehold.co/40x40.png?text=${displayName.charAt(0)}`,
                });
            } catch (profileError) {
                // 프로필 문서 없이 Auth 계정만 남으면 로그인은 되는데 역할을 알 수 없는
                // 좀비 계정이 됩니다. 방금 만든 계정이므로 되돌립니다.
                await deleteUser(credential.user).catch(() => undefined);
                throw profileError;
            }

            toast({
                title: "회원가입 성공",
                description: `${displayName}님, 환영합니다.`,
            });

            // createUserWithEmailAndPassword가 이미 로그인 상태를 만들어 줍니다.
            router.push("/student/dashboard");

        } catch (error) {
            console.error("Error signing up:", error);

            const code = error instanceof FirebaseError ? error.code : undefined;
            const description =
                code === 'auth/email-already-in-use'
                    ? "이미 사용 중인 이름(아이디)입니다."
                    : code === 'auth/weak-password'
                        ? "비밀번호가 너무 단순합니다. 6자리 이상으로 입력해주세요."
                        : "알 수 없는 오류가 발생했습니다. 다시 시도해주세요.";

            toast({
                title: "회원가입 오류",
                description,
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
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>이메일 (비밀번호 초기화용)</FormLabel>
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
