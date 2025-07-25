
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/icons";
import { v4 as uuidv4 } from 'uuid';


const formSchema = z.object({
  name: z.string().min(2, { message: "이름은 2자 이상이어야 합니다." }),
  grade: z.string().min(1, { message: "학년을 입력해주세요." }),
  class: z.string().min(1, { message: "반을 입력해주세요." }),
  number: z.string().min(1, { message: "번호를 입력해주세요." }),
  email: z.string().email({ message: "유효한 이메일 주소를 입력해주세요." }),
  password: z.string().min(6, { message: "비밀번호는 6자 이상이어야 합니다." }),
});

// A simple function to generate a unique ID, since we are not using Firebase Auth's UID
function generateUniqueId() {
    // This is a simple way, for a real app, a more robust method might be needed.
    return uuidv4();
}


export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
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
          title: "회원가입 실패",
          description: "이미 사용 중인 이메일입니다.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      // If email doesn't exist, create new user document in Firestore
      const newUser = {
        uid: generateUniqueId(),
        displayName: values.name,
        email: values.email,
        password: values.password, // Storing password in plaintext, as requested.
        photoURL: `https://placehold.co/40x40.png?text=${values.name.charAt(0)}`,
        role: "student",
        grade: values.grade,
        class: values.class,
        number: values.number,
        createdAt: Date.now(),
      };

      await addDoc(collection(db, "users"), newUser);
      
      toast({
        title: "회원가입 성공",
        description: "로그인 페이지로 이동합니다.",
      });

      router.push("/login");

    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "회원가입 실패",
        description: "회원가입 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-saebyeol-beige p-4">
      <Card className="w-full max-w-md bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-shadow duration-300">
        <CardHeader className="text-center">
           <Link href="/" className="flex justify-center items-center mb-4">
                <Logo className="w-12 h-12 text-jeju-sea" />
            </Link>
          <CardTitle className="text-2xl text-basalt-gray">학생 회원가입</CardTitle>
          <CardDescription className="text-gray-500">계정을 만들어 평가에 참여하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-basalt-gray">이름 (아이디로 사용)</FormLabel>
                    <FormControl>
                      <Input className="bg-gray-50 border-gray-300" placeholder="홍길동" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="grade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-basalt-gray">학년</FormLabel>
                      <FormControl>
                        <Input className="bg-gray-50 border-gray-300" placeholder="1" {...field} />
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
                      <FormLabel className="text-basalt-gray">반</FormLabel>
                      <FormControl>
                        <Input className="bg-gray-50 border-gray-300" placeholder="3" {...field} />
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
                      <FormLabel className="text-basalt-gray">번호</FormLabel>
                      <FormControl>
                        <Input className="bg-gray-50 border-gray-300" placeholder="15" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-basalt-gray">이메일</FormLabel>
                    <FormControl>
                      <Input className="bg-gray-50 border-gray-300" placeholder="email@example.com" {...field} />
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
                    <FormLabel className="text-basalt-gray">비밀번호</FormLabel>
                    <FormControl>
                      <Input className="bg-gray-50 border-gray-300" type="password" placeholder="6자 이상" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-jeju-sea hover:bg-jeju-sea/90" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                회원가입
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-gray-500">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="font-medium text-tangerine hover:underline">
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
