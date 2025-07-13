
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
import { useState, useEffect, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useLanguage } from "@/context/language-context";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scenarios, type TeacherAssessment } from "@/lib/types";

// Mock data for demonstration. In a real app, you'd fetch this from your database.
const mockAssessments: { [key: string]: { title: string; topic: string; prompt: string; expectedFormat: string; startDate?: Date; endDate?: Date, assessmentType: "monologue" | "dialogue", scenario?: Scenario } } = {
  "1": { title: "5단원: 나의 일과", topic: "당신의 일반적인 하루에 대해 이야기하세요.", prompt: "아침에 일어나서 밤에 잠자리에 들 때까지 당신의 일과를 설명해주세요.", expectedFormat: "현재 시제를 사용하고 시간 표현을 포함해야 합니다.", assessmentType: "monologue" },
  "2": { title: "6단원: 사람 묘사하기", topic: "가족 구성원을 묘사하세요.", prompt: "가족 중 한 명을 선택하여 외모와 성격을 묘사해주세요.", expectedFormat: "형용사를 사용하여 외모와 성격을 자세히 묘사해야 합니다.", assessmentType: "monologue" },
  "3": { title: "중간 말하기 시험", topic: "지난 주말에 한 일에 대해 이야기하세요.", prompt: "지난 주말에 있었던 일에 대해 구체적으로 설명해주세요.", expectedFormat: "과거 시제를 정확하게 사용해야 합니다.", assessmentType: "monologue" },
  "4": { title: "7단원: 취미와 관심사", topic: "가장 좋아하는 취미에 대해 1분간 이야기하세요.", prompt: "가장 좋아하는 취미에 대해 이야기해주세요. 무엇인지, 왜 좋아하는지, 얼마나 자주 하는지 언급해야 합니다.", expectedFormat: "학생은 취미를 소개하고, 좋아하는 이유를 제시하며, 빈도를 언급해야 합니다.", startDate: new Date("2024-06-01"), endDate: new Date("2024-06-07"), assessmentType: "monologue" },
};

export default function EditAssessmentPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const formSchema = useMemo(() => z.object({
    title: z.string(),
    topic: z.string(),
    prompt: z.string(),
    expectedFormat: z.string().optional(), // expectedFormat is not used in dialogue
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    assessmentType: z.enum(["monologue", "dialogue"]),
    scenario: z.enum(scenarios).optional(),
  }).superRefine((data, ctx) => {
    const isFreeTalk = data.assessmentType === 'dialogue' && data.scenario === 'free-talk';

    if (!isFreeTalk) {
      if (!data.title) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.teacherAssessmentForm.errors.titleRequired, path: ['title'] });
      }
      if (!data.topic) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.teacherAssessmentForm.errors.topicRequired, path: ['topic'] });
      }
      if (!data.prompt) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.teacherAssessmentForm.errors.promptRequired, path: ['prompt'] });
      }
    }
    
    if (data.assessmentType === 'monologue' && !data.expectedFormat) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.teacherAssessmentForm.errors.expectedFormatRequired, path: ['expectedFormat'] });
    }

    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({ message: t.teacherAssessmentForm.errors.endDate, path: ["endDate"] });
    }
  }), [t]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      topic: "",
      prompt: "",
      expectedFormat: "",
      assessmentType: "monologue",
      scenario: "free-talk"
    },
  });

  const assessmentType = form.watch("assessmentType");
  const scenario = form.watch("scenario");
  const isFreeTalkDialogue = assessmentType === 'dialogue' && scenario === 'free-talk';

  useEffect(() => {
    if (assessmentId) {
      const storedAssessments = JSON.parse(localStorage.getItem('assessments') || '[]');
      let assessmentData = storedAssessments.find((a: any) => a.id === assessmentId);

      if(!assessmentData){
        assessmentData = mockAssessments[assessmentId as keyof typeof mockAssessments];
      }

      if (assessmentData) {
        form.reset({
            ...assessmentData,
            startDate: assessmentData.startDate ? new Date(assessmentData.startDate) : undefined,
            endDate: assessmentData.endDate ? new Date(assessmentData.endDate) : undefined,
        });
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
    form.trigger();
  }, [language, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    
    let submissionValues: TeacherAssessment = {
        id: assessmentId,
        studentsCompleted: 0,
        totalStudents: 20,
        averageScore: 0,
        dateCreated: new Date().toISOString().split('T')[0],
        ...values,
        title: values.title,
        topic: values.topic,
        prompt: values.prompt,
    };

    if (isFreeTalkDialogue) {
        submissionValues.title = values.title || t.teacherAssessmentForm.scenarios.freeTalk;
        submissionValues.topic = values.topic || t.teacherAssessmentForm.freeTalkDefaults.topic;
        submissionValues.prompt = values.prompt || t.teacherAssessmentForm.freeTalkDefaults.prompt;
    }

    console.log(`Updating assessment ${assessmentId} with values:`, submissionValues);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const storedAssessments = localStorage.getItem('assessments');
    let assessments: any[] = storedAssessments ? JSON.parse(storedAssessments) : [];
    const assessmentIndex = assessments.findIndex(a => a.id === assessmentId);

    if (assessmentIndex > -1) {
      assessments[assessmentIndex] = { ...assessments[assessmentIndex], ...submissionValues };
    } else {
        // This case handles editing mock assessments that are not yet in localStorage
        const initialIndex = Object.keys(mockAssessments).indexOf(assessmentId);
        if (initialIndex > -1) {
            // It's a mock assessment, add it to our localStorage array to persist the edit.
            assessments.push(submissionValues);
        } else {
             toast({ title: "Error", description: "Could not find assessment to update.", variant: "destructive" });
             setIsSubmitting(false);
             return;
        }
    }

    localStorage.setItem('assessments', JSON.stringify(assessments));

    toast({
      title: t.teacherAssessmentForm.editSuccessToast.title,
      description: t.teacherAssessmentForm.editSuccessToast.description.replace('{title}', submissionValues.title),
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
              name="assessmentType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>{t.teacherAssessmentForm.typeLabel}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="monologue" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {t.teacherAssessmentForm.typeMonologue}
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="dialogue" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {t.teacherAssessmentForm.typeDialogue}
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {assessmentType === 'dialogue' && (
               <FormField
                  control={form.control}
                  name="scenario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.teacherAssessmentForm.scenarioLabel}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t.teacherAssessmentForm.scenarioPlaceholder} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="free-talk">{t.teacherAssessmentForm.scenarios.freeTalk}</SelectItem>
                          <SelectItem value="ordering-food">{t.teacherAssessmentForm.scenarios.orderingFood}</SelectItem>
                          <SelectItem value="airport-check-in">{t.teacherAssessmentForm.scenarios.airportCheckIn}</SelectItem>
                          <SelectItem value="shopping">{t.teacherAssessmentForm.scenarios.shopping}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>{t.teacherAssessmentForm.scenarioDescription}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.teacherAssessmentForm.titleLabel} {isFreeTalkDialogue && `(${t.teacherAssessmentForm.optional})`}</FormLabel>
                  <FormControl>
                    <Input placeholder={isFreeTalkDialogue ? t.teacherAssessmentForm.scenarios.freeTalk : t.teacherAssessmentForm.titlePlaceholder} {...field} />
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
                  <FormLabel>{t.teacherAssessmentForm.topicLabel} {isFreeTalkDialogue && `(${t.teacherAssessmentForm.optional})`}</FormLabel>
                  <FormControl>
                    <Input placeholder={isFreeTalkDialogue ? t.teacherAssessmentForm.freeTalkDefaults.topic : t.teacherAssessmentForm.topicPlaceholder} {...field} />
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
                  <FormLabel>{assessmentType === 'monologue' ? t.teacherAssessmentForm.promptLabel : t.teacherAssessmentForm.scenarioPromptLabel} {isFreeTalkDialogue && `(${t.teacherAssessmentForm.optional})`}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        isFreeTalkDialogue 
                          ? t.teacherAssessmentForm.freeTalkDefaults.prompt 
                          : assessmentType === 'monologue' 
                            ? t.teacherAssessmentForm.promptPlaceholder 
                            : t.teacherAssessmentForm.scenarioPromptPlaceholder
                      }
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>{assessmentType === 'monologue' ? t.teacherAssessmentForm.promptDescription : t.teacherAssessmentForm.scenarioPromptDescription}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {assessmentType === 'monologue' && (
              <FormField
                control={form.control}
                name="expectedFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.teacherAssessmentForm.expectedFormatLabel} {isFreeTalkDialogue && `(${t.teacherAssessmentForm.optional})`}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={isFreeTalkDialogue ? t.teacherAssessmentForm.freeTalkDefaults.expectedFormat : t.teacherAssessmentForm.expectedFormatPlaceholder}
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>{t.teacherAssessmentForm.expectedFormatDescription}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
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

    
