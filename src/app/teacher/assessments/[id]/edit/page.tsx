
"use client";

import { useRouter, useParams, notFound } from "next/navigation";
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
import { useState, useEffect, useMemo, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useLanguage } from "@/context/language-context";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scenarios, type TeacherAssessment } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function EditAssessmentPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const formSchema = useMemo(() => z.object({
    title: z.string(),
    topic: z.string(),
    prompt: z.string(),
    expectedFormat: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    assessmentType: z.enum(["monologue", "dialogue"]),
    scenario: z.enum(scenarios).optional(),
    recordingTimeLimit: z.coerce.number().int().min(0).optional(),
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
      scenario: "free-talk",
      recordingTimeLimit: 0,
    },
  });

  const assessmentType = form.watch("assessmentType");
  const scenario = form.watch("scenario");
  const isFreeTalkDialogue = assessmentType === 'dialogue' && scenario === 'free-talk';

  const fetchAssessment = useCallback(async () => {
    if (!user || !assessmentId) return;
    try {
        const docRef = doc(db, "assessments", assessmentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().uid === user.uid) {
            const data = docSnap.data() as TeacherAssessment;
            form.reset({
              ...data,
              startDate: data.startDate ? new Date(data.startDate) : undefined,
              endDate: data.endDate ? new Date(data.endDate) : undefined,
            });
        } else {
            toast({ title: "오류", description: "평가를 찾을 수 없거나 수정할 권한이 없습니다.", variant: "destructive" });
            router.push("/teacher/assessments");
        }
    } catch (error) {
        toast({ title: "오류", description: "평가 정보를 불러오는 데 실패했습니다.", variant: "destructive" });
        console.error("Error fetching assessment:", error);
    } finally {
        setIsLoading(false);
    }
  }, [assessmentId, user, form, router, toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/');
      } else {
        fetchAssessment();
      }
    }
  }, [user, authLoading, router, fetchAssessment]);

  useEffect(() => {
    form.trigger();
  }, [language, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !assessmentId) return;
    setIsSubmitting(true);
    
    try {
        let submissionValues: any = { ...values };

        if (isFreeTalkDialogue) {
            submissionValues.title = values.title || t.teacherAssessmentForm.scenarios.freeTalk;
            submissionValues.topic = values.topic || t.teacherAssessmentForm.freeTalkDefaults.topic;
            submissionValues.prompt = values.prompt || t.teacherAssessmentForm.freeTalkDefaults.prompt;
        }
        
        if (submissionValues.assessmentType === 'dialogue' && !submissionValues.expectedFormat) {
            submissionValues.expectedFormat = "발음, 문법, 단어, 문장 등을 평가 주제에 맞게 종합적으로 판단.";
        }

        const docRef = doc(db, "assessments", assessmentId);
        
        const updateData: Partial<TeacherAssessment> = {
            ...submissionValues,
        };

        if (values.startDate) {
            updateData.startDate = values.startDate.toISOString();
        } else {
            updateData.startDate = undefined;
        }
        
        if (values.endDate) {
            updateData.endDate = values.endDate.toISOString();
        } else {
            updateData.endDate = undefined;
        }


        await updateDoc(docRef, updateData);

        toast({
            title: t.teacherAssessmentForm.editSuccessToast.title,
            description: t.teacherAssessmentForm.editSuccessToast.description.replace('{title}', submissionValues.title),
        });
        
        router.push("/teacher/assessments");
    } catch (error) {
        console.error("Error updating assessment:", error);
        toast({ title: "저장 오류", description: "평가를 수정하는 중 문제가 발생했습니다.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (isLoading || authLoading) {
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
            
            <FormField
              control={form.control}
              name="expectedFormat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.teacherAssessmentForm.expectedFormatLabel} {assessmentType === 'dialogue' && `(${t.teacherAssessmentForm.optional})`}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={assessmentType === 'dialogue' ? '발음, 문법, 단어, 문장 등을 평가 주제에 맞게 종합적으로 판단.' : t.teacherAssessmentForm.expectedFormatPlaceholder}
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>{t.teacherAssessmentForm.expectedFormatDescription}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {assessmentType === 'monologue' && (
              <FormField
                control={form.control}
                name="recordingTimeLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.teacherAssessmentForm.timeLimitLabel}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={t.teacherAssessmentForm.timeLimitPlaceholder}
                        {...field}
                        value={field.value ?? ""}
                        onChange={event => field.onChange(parseInt(event.target.value, 10) || 0)}
                      />
                    </FormControl>
                    <FormDescription>{t.teacherAssessmentForm.timeLimitDescription}</FormDescription>
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
