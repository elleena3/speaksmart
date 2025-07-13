"use client";

import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

const formSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요."),
  topic: z.string().min(1, "주제를 입력해주세요."),
  prompt: z.string().min(1, "안내 내용을 입력해주세요."),
  expectedFormat: z.string().min(1, "예상 답변 형식을 입력해주세요."),
});

// Mock data for demonstration. In a real app, you'd fetch this from your database.
const mockAssessments = {
  "1": { title: "5단원: 나의 일과", topic: "당신의 일반적인 하루에 대해 이야기하세요.", prompt: "아침에 일어나서 밤에 잠자리에 들 때까지 당신의 일과를 설명해주세요.", expectedFormat: "현재 시제를 사용하고 시간 표현을 포함해야 합니다." },
  "2": { title: "6단원: 사람 묘사하기", topic: "가족 구성원을 묘사하세요.", prompt: "가족 중 한 명을 선택하여 외모와 성격을 묘사해주세요.", expectedFormat: "형용사를 사용하여 외모와 성격을 자세히 묘사해야 합니다." },
  "3": { title: "중간 말하기 시험", topic: "지난 주말에 한 일에 대해 이야기하세요.", prompt: "지난 주말에 있었던 일에 대해 구체적으로 설명해주세요.", expectedFormat: "과거 시제를 정확하게 사용해야 합니다." },
  "4": { title: "7단원: 취미와 관심사", topic: "가장 좋아하는 취미에 대해 1분간 이야기하세요.", prompt: "가장 좋아하는 취미에 대해 이야기해주세요. 무엇인지, 왜 좋아하는지, 얼마나 자주 하는지 언급해야 합니다.", expectedFormat: "학생은 취미를 소개하고, 좋아하는 이유를 제시하며, 빈도를 언급해야 합니다." },
};

export default function EditAssessmentPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      topic: "",
      prompt: "",
      expectedFormat: "",
    },
  });

  useEffect(() => {
    if (assessmentId) {
      // Simulate fetching data
      const assessmentData = mockAssessments[assessmentId as keyof typeof mockAssessments];
      if (assessmentData) {
        form.reset(assessmentData);
      } else {
        toast({
          title: "오류",
          description: "평가 정보를 찾을 수 없습니다.",
          variant: "destructive"
        })
        router.push("/teacher/assessments");
      }
      setIsLoading(false);
    }
  }, [assessmentId, form, router, toast]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    // Simulate API call to update assessment
    console.log(`Updating assessment ${assessmentId} with values:`, values);
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({
      title: "성공!",
      description: `"${values.title}" 평가가 성공적으로 수정되었습니다.`,
    });

    setIsSubmitting(false);
    router.push("/teacher/assessments");
  }

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    )
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>평가 수정</CardTitle>
        <CardDescription>평가 정보를 수정하려면 아래 양식을 업데이트해주세요.</CardDescription>
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
                  <FormDescription>학생에게 보여질 평가의 이름입니다.</FormDescription>
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
                  <FormDescription>평가 목록에 표시될 간략한 주제입니다.</FormDescription>
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
                      placeholder="학생에게 보여줄 자세한 안내 내용을 입력하세요."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>학생이 평가를 시작할 때 보게 될 상세한 지시사항입니다.</FormDescription>
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
                   <FormDescription>이 내용은 AI 피드백의 정확도를 높이는 데 사용됩니다.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
               <Button type="button" variant="outline" onClick={() => router.back()}>취소</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "저장 중..." : "변경사항 저장"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
