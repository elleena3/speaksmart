
"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarIcon, ChevronsUpDown, Check, Info, Users, Type, Image as ImageIcon, LayoutGrid, Wand2 } from "lucide-react";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useLanguage } from "@/context/language-context";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { scenarios, type TeacherAssessment, femaleVoices, maleVoices, allVoices, evaluationModels, voiceDescriptions, type AiVoice, monologueTypes } from "@/lib/types";
import { useAuth, mockStudents } from "@/context/auth-context";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { generateImage } from "@/ai/flows/generate-image-flow";
import Image from 'next/image';

// ... (FilterCombobox and other imports remain the same)
function FilterCombobox({ label, options, value, onSelect }: { label: string, options: string[], value: string, onSelect: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const displayValue = value === 'all' ? `모든 ${label}` : `${value}${label.endsWith('반') ? '반' : '학년'}`;
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[120px] justify-between text-xs h-8">
          {displayValue}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[120px] p-0">
        <Command>
          <CommandInput placeholder={`${label} 검색...`} />
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


export default function NewAssessmentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voicePopoverOpen, setVoicePopoverOpen] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [formData, setFormData] = useState<z.infer<typeof formSchema> | null>(null);
  const [registeredStudents, setRegisteredStudents] = useState<UserData[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentFilter, setStudentFilter] = useState<{ grade: string, class: string }>({ grade: 'all', class: 'all' });
  
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImageDataUri, setGeneratedImageDataUri] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const formSchema = useMemo(() => z.object({
    title: z.string().optional(),
    topic: z.string().optional(),
    prompt: z.string().optional(),
    expectedFormat: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    assessmentType: z.enum(["monologue", "dialogue"]),
    monologueType: z.enum(monologueTypes).optional(),
    targetType: z.enum(["all", "specific"]).default("all"),
    targetStudentIds: z.array(z.string()).optional(),
    scenario: z.enum(scenarios).optional(),
    recordingTimeLimit: z.coerce.number().int().min(0).optional(),
    aiVoice: z.enum(allVoices).optional().default('algenib'),
    evaluationModel: z.enum(evaluationModels).optional().default('gemini-2.5-pro'),
    useRubric: z.boolean().default(false),
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
    
    if (data.assessmentType === 'monologue' && data.monologueType === 'image' && !generatedImageDataUri) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "이미지를 먼저 생성해주세요.", path: ['monologueType'] });
    }
    
    if (data.assessmentType === 'monologue' && data.monologueType === 'text' && !data.expectedFormat && !data.useRubric) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.teacherAssessmentForm.errors.expectedFormatRequired, path: ['expectedFormat'] });
    }

    if (data.targetType === 'specific' && (!data.targetStudentIds || data.targetStudentIds.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.teacherAssessmentForm.errors.studentRequired, path: ['targetStudentIds']});
    }

    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({ message: t.teacherAssessmentForm.errors.endDate, path: ["endDate"] });
    }
  }), [t, generatedImageDataUri]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      topic: "",
      prompt: "",
      expectedFormat: "",
      assessmentType: "monologue",
      monologueType: "text",
      targetType: "all",
      targetStudentIds: [],
      scenario: "free-talk",
      recordingTimeLimit: 0,
      aiVoice: "algenib",
      evaluationModel: "gemini-2.5-pro",
      useRubric: false,
    },
  });

  const assessmentType = form.watch("assessmentType");
  const monologueType = form.watch("monologueType");
  const targetType = form.watch("targetType");
  const scenario = form.watch("scenario");
  const isFreeTalkDialogue = assessmentType === 'dialogue' && scenario === 'free-talk';
  const useRubric = form.watch("useRubric");

  useEffect(() => {
    if (!authLoading && !user) {
        router.push('/');
    } else if (user) {
        const fetchStudents = async () => {
            if (!db) return;
            setIsLoadingStudents(true);
            const q = query(collection(db, "users"), where("role", "==", "student"));
            const querySnapshot = await getDocs(q);
            const studentList = querySnapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id }) as UserData & { docId: string });
            setRegisteredStudents(studentList);
            setIsLoadingStudents(false);
        }
        fetchStudents();
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    form.trigger();
  }, [language, form]);

  const uniqueGrades = useMemo(() => ['all', ...Array.from(new Set(registeredStudents.map(s => s.grade).filter(Boolean)))], [registeredStudents]);
  const uniqueClasses = useMemo(() => {
    const classes = studentFilter.grade === 'all' 
      ? registeredStudents 
      : registeredStudents.filter(s => s.grade === studentFilter.grade);
    return ['all', ...Array.from(new Set(classes.map(s => s.class).filter(Boolean)))];
  }, [registeredStudents, studentFilter.grade]);

  const filteredRegisteredStudents = useMemo(() => {
    return registeredStudents.filter(student => {
      const gradeMatch = studentFilter.grade === 'all' || student.grade === studentFilter.grade;
      const classMatch = studentFilter.class === 'all' || student.class === studentFilter.class;
      return gradeMatch && classMatch;
    });
  }, [registeredStudents, studentFilter]);

  const handleGenerateImage = async () => {
      if (!imagePrompt) {
          toast({ title: "프롬프트 입력 필요", description: "이미지를 생성할 프롬프트를 입력해주세요.", variant: "destructive" });
          return;
      }
      setIsGeneratingImage(true);
      setGeneratedImageDataUri(null);
      try {
          const result = await generateImage({ prompt: imagePrompt });
          setGeneratedImageDataUri(result.imageDataUri);
          toast({ title: "이미지 생성 완료", description: "AI가 이미지를 성공적으로 그렸습니다." });
      } catch (e) {
          toast({ title: "이미지 생성 실패", description: "이미지 생성 중 오류가 발생했습니다.", variant: "destructive" });
          console.error(e);
      } finally {
          setIsGeneratingImage(false);
      }
  };

  const proceedToSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    setIsSubmitting(true);
    
    try {
        let imageUrl = "";
        if (values.monologueType === 'image' && generatedImageDataUri) {
            toast({title: "이미지 업로드 중..."});
            const imageRef = ref(storage, `assessment-images/${user.uid}/${Date.now()}.png`);
            const uploadResult = await uploadString(imageRef, generatedImageDataUri, 'data_url');
            imageUrl = await getDownloadURL(uploadResult.ref);
            toast({title: "이미지 업로드 완료!"});
        }
      
        let submissionValues: any = { ...values, imageUrl: imageUrl || undefined };

        if (isFreeTalkDialogue) {
            submissionValues.title = values.title || t.teacherAssessmentForm.scenarios.freeTalk;
            submissionValues.topic = values.topic || t.teacherAssessmentForm.freeTalkDefaults.topic;
            submissionValues.prompt = values.prompt || t.teacherAssessmentForm.freeTalkDefaults.prompt;
        }
        
        if ((submissionValues.assessmentType === 'dialogue' || submissionValues.useRubric) && !submissionValues.expectedFormat) {
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

        if (values.assessmentType === 'monologue') {
            delete (docData as any).aiVoice;
            delete (docData as any).scenario;
        } else {
             delete (docData as any).monologueType;
        }

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
        setShowDuplicateWarning(false);
    }
  }


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
        toast({ title: "인증 오류", description: "로그인이 필요합니다.", variant: "destructive" });
        return;
    }

    if (!db) {
      toast({ title: "DB 오류", description: "Firebase가 설정되지 않아 평가를 생성할 수 없습니다.", variant: "destructive" });
      return;
    }
    
    const titleToCheck = values.title || (isFreeTalkDialogue ? t.teacherAssessmentForm.scenarios.freeTalk : "");
    if (!titleToCheck) {
        form.handleSubmit(proceedToSubmit)(values);
        return;
    }
    
    setFormData(values);

    const assessmentsQuery = query(collection(db, "assessments"), where("uid", "==", user.uid), where("title", "==", titleToCheck));
    const querySnapshot = await getDocs(assessmentsQuery);

    if (!querySnapshot.empty) {
        setShowDuplicateWarning(true);
    } else {
        await proceedToSubmit(values);
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
              
              {assessmentType === 'monologue' && (
                  <FormField
                    control={form.control}
                    name="monologueType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>혼자 말하기 유형</FormLabel>
                         <FormControl>
                           <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1">
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                    <FormControl><RadioGroupItem value="text"/></FormControl>
                                    <FormLabel className="font-normal flex items-center gap-2"><Type/>주제/텍스트 제시</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                    <FormControl><RadioGroupItem value="image"/></FormControl>
                                    <FormLabel className="font-normal flex items-center gap-2"><ImageIcon/>Describing a picture(이미지 설명하기)</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                    <FormControl><RadioGroupItem value="comic" /></FormControl>
                                    <FormLabel className="font-normal flex items-center gap-2"><LayoutGrid/>네 컷 만화 설명</FormLabel>
                                </FormItem>
                           </RadioGroup>
                         </FormControl>
                         <FormMessage/>
                      </FormItem>
                    )}
                  />
              )}
            </div>
            
            {monologueType === 'image' && assessmentType === 'monologue' && (
                <Card>
                    <CardHeader>
                        <CardTitle>AI 이미지 생성</CardTitle>
                        <CardDescription>평가에 사용할 이미지를 AI에게 그려달라고 요청하세요.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="image-prompt">이미지 생성 프롬프트</Label>
                                <Textarea 
                                    id="image-prompt"
                                    placeholder="예: a cute cat playing with a yarn ball, cartoon style"
                                    value={imagePrompt}
                                    onChange={(e) => setImagePrompt(e.target.value)}
                                    rows={4}
                                />
                                <Button type="button" onClick={handleGenerateImage} disabled={isGeneratingImage} className="w-full">
                                    {isGeneratingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4"/>}
                                    {isGeneratingImage ? "이미지 생성 중..." : "AI로 이미지 그리기"}
                                </Button>
                            </div>
                            <div className="flex items-center justify-center p-2 border rounded-lg bg-muted/50 min-h-[200px] aspect-square">
                                {isGeneratingImage && <Loader2 className="h-8 w-8 animate-spin text-primary"/>}
                                {generatedImageDataUri && !isGeneratingImage && (
                                    <Image src={generatedImageDataUri} alt="Generated by AI" width={300} height={300} className="rounded-md object-contain"/>
                                )}
                                {!generatedImageDataUri && !isGeneratingImage && (
                                    <p className="text-sm text-muted-foreground text-center">프롬프트를 입력하고 버튼을 누르면 여기에 이미지가 나타납니다.</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}


            <Separator/>

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
                      className="flex space-x-4"
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
                                        key={voice}
                                        type="button"
                                        variant="ghost"
                                        className="w-full justify-start text-left h-auto"
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
                                        key={voice}
                                        type="button"
                                        variant="ghost"
                                        className="w-full justify-start text-left h-auto"
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    {isLoadingStudents ? <Loader2 className="animate-spin" /> : (
                        <div className="space-y-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between p-4">
                                    <CardTitle className="text-base">등록된 학생</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <FilterCombobox label="학년" options={uniqueGrades} value={studentFilter.grade} onSelect={(value) => setStudentFilter({ grade: value, class: 'all' })} />
                                        <FilterCombobox label="반" options={uniqueClasses} value={studentFilter.class} onSelect={(value) => setStudentFilter(prev => ({ ...prev, class: value }))} />
                                        <div className="flex items-center space-x-2 pl-2">
                                            <Label htmlFor="select-all-registered">전체 선택</Label>
                                            <Checkbox
                                                id="select-all-registered"
                                                onCheckedChange={(checked) => {
                                                    const currentIds = form.getValues("targetStudentIds") || [];
                                                    const filteredIds = filteredRegisteredStudents.map(s => s.uid);
                                                    if (checked) {
                                                        form.setValue("targetStudentIds", [...new Set([...currentIds, ...filteredIds])]);
                                                    } else {
                                                        form.setValue("targetStudentIds", currentIds.filter(id => !filteredIds.includes(id)));
                                                    }
                                                }}
                                                checked={filteredRegisteredStudents.length > 0 && filteredRegisteredStudents.every(s => form.getValues("targetStudentIds")?.includes(s.uid))}
                                                disabled={filteredRegisteredStudents.length === 0}
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <Separator />
                                <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2 min-h-[100px]">
                                    {filteredRegisteredStudents.length > 0 ? filteredRegisteredStudents.map((item) => (
                                        <React.Fragment key={item.uid}>
                                            <FormField
                                                control={form.control}
                                                name="targetStudentIds"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value?.includes(item.uid)}
                                                                onCheckedChange={(checked) => {
                                                                    const currentIds = field.value || [];
                                                                    return checked
                                                                    ? field.onChange([...currentIds, item.uid])
                                                                    : field.onChange(currentIds.filter(value => value !== item.uid));
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="font-normal text-sm">{item.displayName}</FormLabel>
                                                    </FormItem>
                                                )}
                                            />
                                        </React.Fragment>
                                    )) : <p className="text-sm text-muted-foreground col-span-full text-center py-8">해당 학년/반에 가입한 학생이 없습니다.</p>}
                                </CardContent>
                            </Card>
                        </div>
                    )}
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
                <AlertDialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>중복된 평가 제목</AlertDialogTitle>
                        <AlertDialogDescription>
                            이미 같은 이름의 평가가 존재합니다. 그래도 계속해서 생성하시겠습니까?
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { if(formData) proceedToSubmit(formData) }}>
                            계속
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

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
