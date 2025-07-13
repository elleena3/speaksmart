
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scenarios, type TeacherAssessment } from "@/lib/types";

export default function NewAssessmentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const formSchema = useMemo(() => z.object({
    title: z.string(),
    topic: z.string(),
    prompt: z.string(),
    expectedFormat: z.string(),
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
      if (!data.expectedFormat) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.teacherAssessmentForm.errors.expectedFormatRequired, path: ['expectedFormat'] });
      }
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
    form.trigger();
  }, [language, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    
    let submissionValues = { ...values };
    if (isFreeTalkDialogue) {
        submissionValues.title = values.title || t.teacherAssessmentForm.scenarios.freeTalk;
        submissionValues.topic = values.topic || t.teacherAssessmentForm.freeTalkDefaults.topic;
        submissionValues.prompt = values.prompt || t.teacherAssessmentForm.freeTalkDefaults.prompt;
        submissionValues.expectedFormat = values.expectedFormat || t.teacherAssessmentForm.freeTalkDefaults.expectedFormat;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const newAssessment: TeacherAssessment = {
      id: new Date().getTime().toString(),
      title: submissionValues.title,
      studentsCompleted: 0,
      totalStudents: 20, 
      averageScore: 0,
      dateCreated: new Date().toISOString().split('T')[0],
      startDate: submissionValues.startDate,
      endDate: submissionValues.endDate,
      assessmentType: submissionValues.assessmentType,
      scenario: submissionValues.scenario,
    };

    const existingAssessments: TeacherAssessment[] = JSON.parse(localStorage.getItem('assessments') || '[]');
    localStorage.setItem('assessments', JSON.stringify([...existingAssessments, newAssessment]));

    toast({
      title: t.teacherAssessmentForm.createSuccessToast.title,
      description: t.teacherAssessmentForm.createSuccessToast.description.replace('{title}', submissionValues.title),
    });

    setIsSubmitting(false);
    router.push("/teacher/assessments");
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
                  <FormLabel>{t.teacherAssessmentForm.titleLabel} {!isFreeTalkDialogue ? null : `(${t.teacherAssessmentForm.optional})`}</FormLabel>
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
                  <FormLabel>{t.teacherAssessmentForm.topicLabel} {!isFreeTalkDialogue ? null : `(${t.teacherAssessmentForm.optional})`}</FormLabel>
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
                  <FormLabel>{assessmentType === 'monologue' ? t.teacherAssessmentForm.promptLabel : t.teacherAssessmentForm.scenarioPromptLabel} {!isFreeTalkDialogue ? null : `(${t.teacherAssessmentForm.optional})`}</FormLabel>
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
                  <FormLabel>{t.teacherAssessmentForm.expectedFormatLabel} {!isFreeTalkDialogue ? null : `(${t.teacherAssessmentForm.optional})`}</FormLabel>
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

    