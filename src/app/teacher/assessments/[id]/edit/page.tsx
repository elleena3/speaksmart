

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
import { Loader2, CalendarIcon, ChevronsUpDown, Check, Info, Edit, Users, Search } from "lucide-react";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useLanguage } from "@/context/language-context";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { scenarios, type TeacherAssessment, femaleVoices, maleVoices, allVoices, evaluationModels, voiceDescriptions, type AiVoice, type UserData } from "@/lib/types";
import { useAuth, mockStudents } from "@/context/auth-context";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';


function FilterCombobox({ label, options, value, onSelect }: { label: string, options: string[], value: string, onSelect: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const displayValue = value === 'all' ? `모든 ${label}` : `${value}${label.endsWith('반') ? '반' : '학년'}`;
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[120px] justify-between">
          {displayValue}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[120px] p-0">
        <Command>
          <CommandList>
            <CommandEmpty>결과 없음.</CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={(currentValue) => {
                    onSelect(currentValue === value ? value : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === option ? 'opacity-100' : 'opacity-0'}`} />
                  {option === 'all' ? `모든 ${label}` : option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


export default function EditAssessmentPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [voicePopoverOpen, setVoicePopoverOpen] = useState(false);
  
  const [realStudents, setRealStudents] = useState<UserData[]>([]);
  const [isStudentListLoading, setIsStudentListLoading] = useState(true);
  const [studentFilter, setStudentFilter] = useState<{ grade: string, class: string }>({ grade: 'all', class: 'all' });

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const formSchema = useMemo(() => z.object({
    title: z.string().optional(),
    topic: z.string().optional(),
    prompt: z.string().optional(),
    expectedFormat: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    assessmentType: z.enum(["monologue", "dialogue"]),
    targetType: z.enum(["all", "specific"]).default("all"),
    targetStudentIds: z.union([z.literal('all'), z.array(z.string())]),
    scenario: z.enum(scenarios).optional(),
    recordingTimeLimit: z.coerce.number().int().min(0).optional(),
    aiVoice: z.enum(allVoices).optional().default('algenib'),
    evaluationModel: z.enum(evaluationModels).optional().default('googleai/gemini-3.1-pro-preview'),
    useRubric: z.boolean().default(false),
  }).superRefine((data, ctx) => {
    const isFreeTalkDialogue = data.assessmentType === 'dialogue' && data.scenario === 'free-talk';

    if (!isFreeTalkDialogue) {
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
    
    if (data.assessmentType === 'monologue' && !data.expectedFormat && !data.useRubric) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.teacherAssessmentForm.errors.expectedFormatRequired, path: ['expectedFormat'] });
    }

    if (data.targetType === 'specific' && (data.targetStudentIds === 'all' || data.targetStudentIds.length === 0)) {
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
      targetStudentIds: "all",
      scenario: "free-talk",
      recordingTimeLimit: 0,
      aiVoice: 'algenib',
      evaluationModel: 'googleai/gemini-3.1-pro-preview',
      useRubric: false,
    },
  });

  const assessmentType = form.watch("assessmentType");
  const targetType = form.watch("targetType");
  const scenario = form.watch("scenario");
  const isFreeTalkDialogue = assessmentType === 'dialogue' && scenario === 'free-talk';
  const useRubric = form.watch("useRubric");

  const fetchAssessmentAndStudents = useCallback(async () => {
    if (!user || !assessmentId) return;

    if (!db) {
      toast({ title: "오류", description: "Firebase가 설정되지 않아 데이터를 불러올 수 없습니다.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    
    try {
        const docRef = doc(db, "assessments", assessmentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().uid === user.uid) {
            const data = docSnap.data() as TeacherAssessment;
            form.reset({
              ...data,
              startDate: data.startDate ? new Date(data.startDate) : undefined,
              endDate: data.endDate ? new Date(data.endDate) : undefined,
              targetType: Array.isArray(data.targetStudentIds) ? 'specific' : 'all',
              targetStudentIds: data.targetStudentIds,
              aiVoice: data.aiVoice || 'algenib',
              evaluationModel: data.evaluationModel || 'googleai/gemini-3.1-pro-preview',
              useRubric: data.useRubric || false,
            });
        } else {
            toast({ title: "오류", description: "평가를 찾을 수 없거나 수정할 권한이 없습니다.", variant: "destructive" });
            router.push("/teacher/assessments");
            return;
        }

        // Fetch students
        setIsStudentListLoading(true);
        const q = query(collection(db, "users"), where("role", "==", "student"));
        const querySnapshot = await getDocs(q);
        const studentList = querySnapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id }) as UserData);
        setRealStudents(studentList);
        setIsStudentListLoading(false);

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
        fetchAssessmentAndStudents();
      }
    }
  }, [user, authLoading, router, fetchAssessmentAndStudents]);

  useEffect(() => {
    form.trigger();
  }, [language, form]);

  const uniqueGrades = useMemo(() => ['all', ...Array.from(new Set(realStudents.map(s => s.grade || ''))).filter(g => g)], [realStudents]);
  const uniqueClasses = useMemo(() => ['all', ...Array.from(new Set(realStudents.filter(s => studentFilter.grade === 'all' || s.grade === studentFilter.grade).map(s => s.class || ''))).filter(c => c)], [realStudents, studentFilter.grade]);

  const filteredRealStudents = useMemo(() => {
    return realStudents.filter(student => {
      const gradeMatch = studentFilter.grade === 'all' || student.grade === studentFilter.grade;
      const classMatch = studentFilter.class === 'all' || student.class === studentFilter.class;
      return gradeMatch && classMatch;
    });
  }, [realStudents, studentFilter]);

   const handleSelectAll = (studentsToSelect: UserData[], field: any) => {
    const currentSelection = new Set(Array.isArray(field.value) ? field.value : []);
    const allIds = new Set(studentsToSelect.map(s => s.docId!));
    const areAllSelected = studentsToSelect.every(s => currentSelection.has(s.docId!));

    if (areAllSelected) {
        studentsToSelect.forEach(s => currentSelection.delete(s.docId!));
    } else {
        studentsToSelect.forEach(s => currentSelection.add(s.docId!));
    }
    field.onChange(Array.from(currentSelection));
  };
  
  const handleSelectAllMock = (field: any) => {
     const currentSelection = new Set(Array.isArray(field.value) ? field.value : []);
     const allMockIds = new Set(mockStudents.map(s => s.uid));
     const areAllSelected = mockStudents.every(s => currentSelection.has(s.uid));
     
     if(areAllSelected) {
         mockStudents.forEach(s => currentSelection.delete(s.uid));
     } else {
         mockStudents.forEach(s => currentSelection.add(s.uid));
     }
     field.onChange(Array.from(currentSelection));
  }


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !assessmentId || !db) return;
    setIsSubmitting(true);
    
    try {
        let submissionValues: any = { ...values };

        if (isFreeTalkDialogue) {
            submissionValues.title = values.title || t.teacherAssessmentForm.scenarios.freeTalk;
            submissionValues.topic = values.topic || t.teacherAssessmentForm.freeTalkDefaults.topic;
            submissionValues.prompt = values.prompt || t.teacherAssessmentForm.freeTalkDefaults.prompt;
        }
        
        if ((submissionValues.assessmentType === 'dialogue' || submissionValues.useRubric) && !submissionValues.expectedFormat) {
            submissionValues.expectedFormat = "발음, 문법, 단어, 문장 등을 평가 주제에 맞게 종합적으로 판단.";
        }

        const docRef = doc(db, "assessments", assessmentId);
        
        const updateData: Partial<TeacherAssessment> = {
            ...submissionValues,
            targetStudentIds: values.targetType === 'all' ? 'all' : (values.targetStudentIds as string[]),
        };
        delete (updateData as any).targetType;

        if (values.startDate) {
            updateData.startDate = values.startDate.toISOString();
        } else {
            delete (updateData as any).startDate;
        }
        
        if (values.endDate) {
            updateData.endDate = values.endDate.toISOString();
        } else {
            delete (updateData as any).endDate;
        }

        if (values.assessmentType === 'monologue') {
            delete (updateData as any).aiVoice;
            delete (updateData as any).scenario;
        }

        // Ensure createdAt is not overwritten
        delete (updateData as any).createdAt;


        await updateDoc(docRef, updateData as any);

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
                name="targetType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>{t.teacherAssessmentForm.targetLabel}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => {
                            field.onChange(value);
                            if (value === 'all') {
                                form.setValue('targetStudentIds', 'all');
                            } else {
                                const currentSelection = form.getValues('targetStudentIds');
                                if (currentSelection === 'all') {
                                    form.setValue('targetStudentIds', []);
                                }
                            }
                        }}
                        value={field.value}
                        className="flex items-center space-x-4"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl><RadioGroupItem value="all" /></FormControl>
                          <FormLabel className="font-normal">{t.teacherAssessmentForm.targetAll}</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl><RadioGroupItem value="specific" /></FormControl>
                          <FormLabel className="font-normal">{t.teacherAssessmentForm.targetSpecific}</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            {targetType === 'specific' && (
              <FormField
                control={form.control}
                name="targetStudentIds"
                render={({ field }) => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">{t.teacherAssessmentForm.selectStudentsLabel}</FormLabel>
                      <FormDescription>{t.teacherAssessmentForm.selectStudentsDescription}</FormDescription>
                    </div>
                     <div className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between p-4">
                                <CardTitle className="text-lg flex items-center gap-2"><Edit className="h-5 w-5"/>목업 계정</CardTitle>
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor="select-all-mock">전체 선택</Label>
                                    <Checkbox
                                        id="select-all-mock"
                                        onCheckedChange={() => handleSelectAllMock(field)}
                                        checked={Array.isArray(field.value) && mockStudents.every(s => field.value.includes(s.uid))}
                                    />
                                </div>
                            </CardHeader>
                             <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                {mockStudents.map((item) => (
                                    <FormItem key={item.uid} className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={Array.isArray(field.value) && field.value.includes(item.uid)}
                                                onCheckedChange={(checked) => {
                                                    const currentSelection = new Set(Array.isArray(field.value) ? field.value : []);
                                                    if(checked) {
                                                        currentSelection.add(item.uid);
                                                    } else {
                                                        currentSelection.delete(item.uid);
                                                    }
                                                    field.onChange(Array.from(currentSelection));
                                                }}
                                            />
                                        </FormControl>
                                        <FormLabel className="font-normal">{item.displayName}</FormLabel>
                                    </FormItem>
                                ))}
                            </CardContent>
                        </Card>
                        <Card>
                           <CardHeader className="flex flex-row items-center justify-between p-4">
                              <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5"/>가입한 학생</CardTitle>
                              <div className="flex items-center gap-2">
                                <FilterCombobox label="학년" options={uniqueGrades} value={studentFilter.grade} onSelect={(value) => setStudentFilter({ grade: value, class: 'all' })} />
                                <FilterCombobox label="반" options={uniqueClasses} value={studentFilter.class} onSelect={(value) => setStudentFilter({ ...studentFilter, class: value })} />
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor="select-all-real">전체 선택</Label>
                                    <Checkbox
                                        id="select-all-real"
                                        onCheckedChange={() => handleSelectAll(filteredRealStudents, field)}
                                        checked={Array.isArray(field.value) && filteredRealStudents.length > 0 && filteredRealStudents.every(s => field.value.includes(s.docId!))}
                                    />
                                </div>
                              </div>
                           </CardHeader>
                           <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                               {isStudentListLoading ? <Loader2 className="animate-spin"/> :
                               filteredRealStudents.length > 0 ? (
                                   filteredRealStudents.map((item) => (
                                    <FormItem key={item.docId}>
                                        <div className="flex flex-row items-start space-x-3 space-y-0">
                                            <FormControl>
                                                <Checkbox
                                                    checked={Array.isArray(field.value) && field.value.includes(item.docId!)}
                                                    onCheckedChange={(checked) => {
                                                        const currentSelection = new Set(Array.isArray(field.value) ? field.value : []);
                                                        if (checked) {
                                                            currentSelection.add(item.docId!);
                                                        } else {
                                                            currentSelection.delete(item.docId!);
                                                        }
                                                        field.onChange(Array.from(currentSelection));
                                                    }}
                                                />
                                            </FormControl>
                                            <FormLabel className="font-normal">{item.displayName}</FormLabel>
                                        </div>
                                    </FormItem>
                                    ))
                               ) : <p className="text-sm text-muted-foreground col-span-full text-center">해당 조건의 학생이 없습니다.</p>}
                           </CardContent>
                        </Card>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
                control={form.control}
                name="assessmentType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>{t.teacherAssessmentForm.typeLabel}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
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
                name="aiVoice"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t.teacherAssessmentForm.voiceLabel}</FormLabel>
                    <Popover open={voicePopoverOpen} onOpenChange={setVoicePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                          >
                            {field.value
                              ? `${voiceDescriptions[field.value as AiVoice]}`
                              : t.teacherAssessmentForm.voicePlaceholder}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[450px] p-0" align="start">
                        <div className="grid grid-cols-2 gap-2 p-2">
                            <div>
                                <p className="px-2 py-1.5 text-sm font-semibold">{t.teacherAssessmentForm.voices.female}</p>
                                <div className="flex flex-col space-y-1">
                                {femaleVoices.map((voice) => (
                                    <Button
                                        type="button"
                                        key={voice}
                                        variant="ghost"
                                        className="w-full justify-start text-left"
                                        onClick={() => {
                                            form.setValue("aiVoice", voice);
                                            setVoicePopoverOpen(false);
                                        }}
                                    >
                                        <div className="flex items-center">
                                            <Check className={cn("mr-2 h-4 w-4", field.value === voice ? "opacity-100" : "opacity-0")} />
                                            <div>
                                                <p className="font-medium">{voiceDescriptions[voice]}</p>
                                            </div>
                                        </div>
                                    </Button>
                                ))}
                                </div>
                            </div>
                            <div>
                               <p className="px-2 py-1.5 text-sm font-semibold">{t.teacherAssessmentForm.voices.male}</p>
                               <div className="flex flex-col space-y-1">
                                {maleVoices.map((voice) => (
                                    <Button
                                        type="button"
                                        key={voice}
                                        variant="ghost"
                                        className="w-full justify-start text-left"
                                        onClick={() => {
                                            form.setValue("aiVoice", voice);
                                            setVoicePopoverOpen(false);
                                        }}
                                    >
                                        <div className="flex items-center">
                                             <Check className={cn("mr-2 h-4 w-4", field.value === voice ? "opacity-100" : "opacity-0")} />
                                             <div>
                                                <p className="font-medium">{voiceDescriptions[voice]}</p>
                                            </div>
                                        </div>
                                    </Button>
                                ))}
                                </div>
                            </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormDescription>{t.teacherAssessmentForm.voiceDescription}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="evaluationModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AI 평가 모델 선택</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="평가에 사용할 AI 모델을 선택하세요..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {evaluationModels.map(model => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>평가 분석에 사용할 AI 모델을 선택합니다. 특정 모델의 성능을 테스트하거나 목적에 맞는 모델을 사용할 수 있습니다.</FormDescription>
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
                      <Select onValueChange={field.onChange} value={field.value}>
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
                  <FormLabel>{t.teacherAssessmentForm.expectedFormatLabel} {(assessmentType === 'dialogue' || useRubric) && `(${t.teacherAssessmentForm.optional})`}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={assessmentType === 'dialogue' ? '발음, 문법, 단어, 문장 등을 평가 주제에 맞게 종합적으로 판단.' : t.teacherAssessmentForm.expectedFormatPlaceholder}
                      rows={4}
                      {...field}
                      disabled={useRubric}
                    />
                  </FormControl>
                  <FormDescription>{t.teacherAssessmentForm.expectedFormatDescription}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
             <FormField
              control={form.control}
              name="useRubric"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      영어 회화 평가 루브릭 적용
                    </FormLabel>
                    <FormDescription>
                      표준화된 루브릭을 사용하여 AI 평가의 일관성과 정확성을 높입니다.
                    </FormDescription>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button type="button" variant="ghost" size="sm"><Info className="mr-2 h-4 w-4"/> 자세히 보기</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl h-[90vh]">
                        <DialogHeader>
                          <DialogTitle>영어 회화 능력 평가 루브릭</DialogTitle>
                        </DialogHeader>
                        <iframe src="/rubric.html" className="w-full h-full border-0" title="영어 회화 능력 평가 루브릭"></iframe>
                      </DialogContent>
                    </Dialog>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
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
                                type="button"
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
                                type="button"
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
