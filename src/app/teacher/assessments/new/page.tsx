
"use client";

import { useRouter } from "next/navigation";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { scenarios, type TeacherAssessment, femaleVoices, maleVoices } from "@/lib/types";
import { useAuth, mockStudents } from "@/context/auth-context";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

const allVoices = [...femaleVoices, ...maleVoices] as const;

export default function NewAssessmentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const formSchema = useMemo(() => z.object({
    title: z.string().optional(),
    topic: z.string().optional(),
    prompt: z.string().optional(),
    expectedFormat: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    assessmentType: z.enum(["monologue", "dialogue"]),
    targetType: z.enum(["all", "specific"]).default("all"),
    targetStudentIds: z.array(z.string()).optional(),
    scenario: z.enum(scenarios).optional(),
    recordingTimeLimit: z.coerce.number().int().min(0).optional(),
    aiVoice: z.enum(allVoices).optional().default('Alpheratz'),
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

    if (data.targetType === 'specific' && (!data.targetStudentIds || data.targetStudentIds.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.teacherAssessmentForm.errors.studentRequired, path: ['targetStudentIds']});
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
      targetType: "all",
      targetStudentIds: [],
      scenario: "free-talk",
      recordingTimeLimit: 0,
      aiVoice: "Alpheratz",
    },
  });

  const assessmentType = form.watch("assessmentType");
  const targetType = form.watch("targetType");
  const scenario = form.watch("scenario");
  const isFreeTalkDialogue = assessmentType === 'dialogue' && scenario === 'free-talk';

  useEffect(() => {
    if (!authLoading && !user) {
        router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    form.trigger();
  }, [language, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
        toast({ title: "인증 오류", description: "로그인이 필요합니다.", variant: "destructive" });
        return;
    }

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
        
        const docData: Partial<Omit<TeacherAssessment, "id">> = {
            ...submissionValues,
            targetStudentIds: values.targetType === 'all' ? 'all' : values.targetStudentIds,
            uid: user.uid,
            averageScore: 0,
            dateCreated: new Date().toISOString().split('T')[0],
            createdAt: Date.now(),
            submissionCount: 0,
        };
        
        delete (docData as any).targetType;

        if (values.startDate) {
            docData.startDate = values.startDate.toISOString();
        }
        if (values.endDate) {
            docData.endDate = values.endDate.toISOString();
        }

        // Remove voice and scenario if it's not a dialogue
        if (values.assessmentType === 'monologue') {
            delete (docData as any).aiVoice;
            delete (docData as any).scenario;
        }

        // Remove undefined fields before sending to Firestore
        Object.keys(docData).forEach(key => docData[key as keyof typeof docData] === undefined && delete docData[key as keyof typeof docData]);

        await addDoc(collection(db, "assessments"), docData);

        toast({
            title: t.teacherAssessmentForm.createSuccessToast.title,
            description: t.teacherAssessmentForm.createSuccessToast.description.replace('{title}', submissionValues.title),
        });
        
        router.push("/teacher/assessments");

    } catch (error) {
        console.error("Error creating assessment: ", error);
        toast({ title: "생성 오류", description: "평가를 생성하는 중 문제가 발생했습니다.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (authLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>{t.teacherAssessmentForm.createTitle}</CardTitle>
        <CardDescription>{t.teacherAssessmentForm.createDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <FormField
                control={form.control}
                name="targetType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>{t.teacherAssessmentForm.targetLabel}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="all" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {t.teacherAssessmentForm.targetAll}
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="specific" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {t.teacherAssessmentForm.targetSpecific}
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {assessmentType === 'dialogue' && (
              <FormField
                control={form.control}
                name="aiVoice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.teacherAssessmentForm.voiceLabel}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t.teacherAssessmentForm.voicePlaceholder} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>{t.teacherAssessmentForm.voices.female}</SelectLabel>
                          {femaleVoices.map(voice => (
                            <SelectItem key={voice} value={voice}>{voice}</SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>{t.teacherAssessmentForm.voices.male}</SelectLabel>
                           {maleVoices.map(voice => (
                            <SelectItem key={voice} value={voice}>{voice}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>{t.teacherAssessmentForm.voiceDescription}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {targetType === 'specific' && (
              <FormField
                control={form.control}
                name="targetStudentIds"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">{t.teacherAssessmentForm.selectStudentsLabel}</FormLabel>
                      <FormDescription>
                        {t.teacherAssessmentForm.selectStudentsDescription}
                      </FormDescription>
                    </div>
                    {mockStudents.map((item) => (
                      <FormField
                        key={item.uid}
                        control={form.control}
                        name="targetStudentIds"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={item.uid}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(item.uid)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), item.uid])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== item.uid
                                          )
                                        )
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {item.displayName} ({item.email})
                              </FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                        onChange={event => field.onChange(parseInt(event.target.value, 10) || undefined)}
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
                {isSubmitting ? t.teacherAssessmentForm.creatingButton : t.teacherAssessmentForm.createButton}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

    