
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
import { Loader2, CalendarIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useLanguage } from "@/context/language-context";

const formSchema = z.object({
  title: z.string().min(1, "Title is required."),
  topic: z.string().min(1, "Topic is required."),
  prompt: z.string().min(1, "Prompt is required."),
  expectedFormat: z.string().min(1, "Expected format is required."),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
}).refine((data) => {
    if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
    }
    return true;
}, {
    message: "End date cannot be earlier than start date.",
    path: ["endDate"],
});

// Mock data for demonstration. In a real app, you'd fetch this from your database.
const mockAssessments: { [key: string]: { title: string; topic: string; prompt: string; expectedFormat: string; startDate?: Date; endDate?: Date } } = {
  "1": { title: "5단원: 나의 일과", topic: "당신의 일반적인 하루에 대해 이야기하세요.", prompt: "아침에 일어나서 밤에 잠자리에 들 때까지 당신의 일과를 설명해주세요.", expectedFormat: "현재 시제를 사용하고 시간 표현을 포함해야 합니다." },
  "2": { title: "6단원: 사람 묘사하기", topic: "가족 구성원을 묘사하세요.", prompt: "가족 중 한 명을 선택하여 외모와 성격을 묘사해주세요.", expectedFormat: "형용사를 사용하여 외모와 성격을 자세히 묘사해야 합니다." },
  "3": { title: "중간 말하기 시험", topic: "지난 주말에 한 일에 대해 이야기하세요.", prompt: "지난 주말에 있었던 일에 대해 구체적으로 설명해주세요.", expectedFormat: "과거 시제를 정확하게 사용해야 합니다." },
  "4": { title: "7단원: 취미와 관심사", topic: "가장 좋아하는 취미에 대해 1분간 이야기하세요.", prompt: "가장 좋아하는 취미에 대해 이야기해주세요. 무엇인지, 왜 좋아하는지, 얼마나 자주 하는지 언급해야 합니다.", expectedFormat: "학생은 취미를 소개하고, 좋아하는 이유를 제시하며, 빈도를 언급해야 합니다.", startDate: new Date("2024-06-01"), endDate: new Date("2024-06-07") },
};

export default function EditAssessmentPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const currentFormSchema = formSchema.refine((data) => {
    if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
    }
    return true;
    }, {
    message: t.teacherAssessmentForm.errorEndDate,
    path: ["endDate"],
  });

  const form = useForm<z.infer<typeof currentFormSchema>>({
    resolver: zodResolver(currentFormSchema),
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
          title: "Error",
          description: "Assessment data not found.",
          variant: "destructive"
        })
        router.push("/teacher/assessments");
      }
      setIsLoading(false);
    }
  }, [assessmentId, form, router, toast]);

  useEffect(() => {
    const zodSchema = formSchema.refine((data) => {
      if (data.startDate && data.endDate) {
          return data.endDate >= data.startDate;
      }
      return true;
      }, {
      message: t.teacherAssessmentForm.errorEndDate,
      path: ["endDate"],
    });

    form.trigger(); // Re-validate form on language change
  }, [language, t, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    // Simulate API call to update assessment
    console.log(`Updating assessment ${assessmentId} with values:`, values);
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({
      title: t.teacherAssessmentForm.editSuccessToast.title,
      description: t.teacherAssessmentForm.editSuccessToast.description.replace('{title}', values.title),
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
        <CardTitle>{t.teacherAssessmentForm.editTitle}</CardTitle>
        <CardDescription>{t.teacherAssessmentForm.editDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.teacherAssessmentForm.titleLabel}</FormLabel>
                  <FormControl>
                    <Input placeholder={t.teacherAssessmentForm.titlePlaceholder} {...field} />
                  </FormControl>
                  <FormDescription>{t.teacherAssessmentForm.titleDescription}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.teacherAssessmentForm.topicLabel}</FormLabel>
                  <FormControl>
                    <Input placeholder={t.teacherAssessmentForm.topicPlaceholder} {...field} />
                  </FormControl>
                  <FormDescription>{t.teacherAssessmentForm.topicDescription}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.teacherAssessmentForm.promptLabel}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t.teacherAssessmentForm.promptPlaceholder}
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>{t.teacherAssessmentForm.promptDescription}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expectedFormat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.teacherAssessmentForm.expectedFormatLabel}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t.teacherAssessmentForm.expectedFormatPlaceholder}
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                   <FormDescription>{t.teacherAssessmentForm.expectedFormatDescription}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>{t.teacherAssessmentForm.startDateLabel}</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value ? (
                                    format(field.value, "PPP")
                                ) : (
                                    <span>{t.teacherAssessmentForm.datePlaceholder}</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                        <FormDescription>
                            {t.teacherAssessmentForm.startDateDescription}
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>{t.teacherAssessmentForm.endDateLabel}</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value ? (
                                    format(field.value, "PPP")
                                ) : (
                                    <span>{t.teacherAssessmentForm.datePlaceholder}</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                    form.getValues("startDate") ? date < form.getValues("startDate")! : false
                                }
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                        <FormDescription>
                           {t.teacherAssessmentForm.endDateDescription}
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <div className="flex justify-end gap-2">
               <Button type="button" variant="outline" onClick={() => router.back()}>{t.teacherAssessmentForm.cancelButton}</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? t.teacherAssessmentForm.savingButton : t.teacherAssessmentForm.saveButton}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
