"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요."),
  topic: z.string().min(1, "주제를 입력해주세요."),
  prompt: z.string().min(1, "안내 내용을 입력해주세요."),
  expectedFormat: z.string().min(1, "예상 답변 형식을 입력해주세요."),
});

export default function NewAssessmentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      topic: "",
      prompt: "",
      expectedFormat: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    // Simulate API call to create assessment
    console.log("Creating assessment with values:", values);
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({
      title: "성공!",
      description: `"${values.title}" 평가가 성공적으로 생성되었습니다.`,
    });

    setIsSubmitting(false);
    router.push("/teacher/assessments");
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>새 평가 만들기</CardTitle>
        <CardDescription>새로운 말하기 평가를 생성하려면 아래 양식을 작성해주세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>평가 제목</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 7단원: 취미와 관심사" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>평가 주제</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 가장 좋아하는 취미에 대해 1분간 이야기하세요." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>학생 안내 내용</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="학생에게 보여줄 자세한 안내 내용을 입력하세요. 예를 들어, 포함해야 할 핵심 포인트나 시간 제한 등을 명시할 수 있습니다."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expectedFormat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AI 평가를 위한 예상 답변 형식</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="AI가 평가할 때 참고할 학생의 예상 답변 형식이나 핵심 요소를 설명해주세요."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "생성 중..." : "평가 생성"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
