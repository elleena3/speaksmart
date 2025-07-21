

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { type TeacherAssessment, type StudentResult, type ResultSummary, type RubricScores } from "@/lib/types";
import { useAuth, mockStudents } from "@/context/auth-context";
import { Loader2, User, Sparkles, TrendingUp, DraftingCompass } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { generateGrowthFeedback, type GenerateGrowthFeedbackOutput } from "@/ai/flows/generate-growth-feedback-flow";


function AttemptDetailView({ result, assessment, attemptNumber }: { result: StudentResult, assessment: TeacherAssessment, attemptNumber: number }) {
  const {
    aiFeedback,
    studentTranscript,
    studentRecordingUrl,
    pronunciationScore,
    contentScore,
    studentRawFeedback,
    teacherGuidance,
    curricularRemarks,
    rubricScores,
  } = result;

  const isRubricUsed = !!rubricScores;
  const rubricSubjects = assessment.assessmentType === 'dialogue'
    ? ['유창성', '발음', '문법', '어휘', '상호작용']
    : ['유창성', '발음', '문법', '어휘'];

  const radarChartData = useMemo(() => {
    if (!isRubricUsed || !rubricScores) return [];
    return rubricSubjects.map(subject => {
        let score = 0;
        switch(subject) {
            case '유창성': score = rubricScores.fluency; break;
            case '발음': score = rubricScores.pronunciation; break;
            case '문법': score = rubricScores.grammar; break;
            case '어휘': score = rubricScores.vocabulary; break;
            case '상호작용': score = rubricScores.interaction || 0; break;
        }
        return { subject, score };
    });
  }, [isRubricUsed, rubricScores, rubricSubjects]);


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>학생 답변</CardTitle>
          <CardDescription>{attemptNumber}차 시도의 학생 음성 답변과 텍스트 변환 내용입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {studentRecordingUrl && (
            <audio controls src={studentRecordingUrl} className="w-full" />
          )}
          <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-mono text-sm leading-relaxed italic max-h-60 overflow-y-auto">
            "{studentTranscript}"
          </div>
        </CardContent>
      </Card>

      {!isRubricUsed && (
          <Card>
            <CardHeader>
              <CardTitle>AI 성능 분석</CardTitle>
              <CardDescription>AI가 분석한 내용 및 발음 점수입니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contentScore !== undefined && (
                <div className="w-full">
                  <div className="flex justify-between mb-1">
                    <span className="text-base font-medium text-primary">내용 점수</span>
                    <span className="text-sm font-medium text-primary">{contentScore}%</span>
                  </div>
                  <Progress value={contentScore} className="h-2" />
                </div>
              )}
              {pronunciationScore !== undefined && (
                <div className="w-full">
                  <div className="flex justify-between mb-1">
                    <span className="text-base font-medium text-primary">발음 점수</span>
                    <span className="text-sm font-medium text-primary">{pronunciationScore}%</span>
                  </div>
                  <Progress value={pronunciationScore} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
      )}
      
        {isRubricUsed && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><DraftingCompass />루브릭 영역별 분석</CardTitle>
                    <CardDescription>루브릭 항목별 점수입니다. (5점 만점)</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarChartData}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="subject" />
                            <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} />
                            <Radar name="점수" dataKey="score" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.4} />
                        </RadarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        )}
      
      <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
                <CardTitle>교사용 AI 조언</CardTitle>
            </CardHeader>
            <CardContent className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed min-h-[150px]">
                {teacherGuidance}
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
                <CardTitle>생활기록부 교과 특기 사항</CardTitle>
            </CardHeader>
            <CardContent className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed min-h-[150px]">
                {curricularRemarks}
            </CardContent>
          </Card>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>학생에게 제공된 AI 종합 피드백</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg font-body text-base leading-relaxed markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {aiFeedback}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {studentRawFeedback && (
        <Card>
            <CardHeader>
                <CardTitle>학생이 보낸 피드백</CardTitle>
                <CardDescription>이 평가 활동에 대해 학생이 남긴 의견입니다.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed italic">
                "{studentRawFeedback}"
            </CardContent>
        </Card>
      )}
    </div>
  )
}

const chartConfig = {
    contentScore: {
      label: "내용 점수",
      color: "hsl(var(--chart-1))",
    },
    pronunciationScore: {
      label: "발음 점수",
      color: "hsl(var(--chart-2))",
    },
};


function TeacherGrowthView({ results, assessment }: { results: StudentResult[], assessment: TeacherAssessment }) {
    const [growthFeedback, setGrowthFeedback] = useState<GenerateGrowthFeedbackOutput | null>(null);
    const [isLoadingFeedback, setIsLoadingFeedback] = useState(true);
    const { toast } = useToast();
    
    const latestResult = results[results.length - 1];

    const chartData = useMemo(() => {
        if (latestResult.historicalScores && latestResult.historicalScores.length > 0) {
            return latestResult.historicalScores.map(hs => ({ name: `${hs.attempt}차`, contentScore: hs.contentScore, pronunciationScore: hs.pronunciationScore }));
        }
        return results.map((r, i) => ({ name: `${i + 1}차`, contentScore: r.contentScore ?? 0, pronunciationScore: r.pronunciationScore ?? 0, }));
    }, [latestResult.historicalScores, results]);

    const isRubricUsed = useMemo(() => {
        return results.some(r => !!r.rubricScores);
    }, [results]);

    const rubricSubjects = useMemo(() => assessment.assessmentType === 'dialogue'
        ? ['유창성', '발음', '문법', '어휘', '상호작용']
        : ['유창성', '발음', '문법', '어휘'], [assessment.assessmentType]);

    const radarChartData = useMemo(() => {
        const data = rubricSubjects.map(subject => {
            const entry: { [key: string]: string | number } = { subject };
            const source = latestResult.historicalScores && latestResult.historicalScores.length > 0
                ? latestResult.historicalScores
                : results.map((r, i) => ({ ...r, attempt: i + 1 }));

            source.forEach((hs, i) => {
                const attemptData = 'historicalScores' in hs ? hs : { rubricScores: hs.rubricScores, attempt: i + 1 };
                const key = `attempt${attemptData.attempt}`;
                if (attemptData.rubricScores) {
                    switch(subject) {
                        case '유창성': entry[key] = attemptData.rubricScores.fluency; break;
                        case '발음': entry[key] = attemptData.rubricScores.pronunciation; break;
                        case '문법': entry[key] = attemptData.rubricScores.grammar; break;
                        case '어휘': entry[key] = attemptData.rubricScores.vocabulary; break;
                        case '상호작용': entry[key] = attemptData.rubricScores.interaction || 0; break;
                    }
                } else {
                     entry[key] = 0;
                }
            });
            return entry;
        });
        return data;
    }, [latestResult.historicalScores, results, rubricSubjects]);

     useEffect(() => {
        if (results.length > 1) {
            if (latestResult.growthFeedback && latestResult.growthFeedbackForAttempts === results.length) {
                setGrowthFeedback({
                    growthFeedback: latestResult.growthFeedback,
                    teacherGuidance: latestResult.growthTeacherGuidance || "",
                    curricularRemarks: latestResult.growthCurricularRemarks || ""
                });
                setIsLoadingFeedback(false);
            } else {
                const fetchGrowthFeedback = async () => {
                    setIsLoadingFeedback(true);
                    try {
                        const attempts: ResultSummary[] = results.map((r, index) => ({
                          attemptNumber: index + 1,
                          contentScore: r.contentScore ?? 0,
                          pronunciationScore: r.pronunciationScore ?? 0,
                          transcript: r.studentTranscript ?? "",
                          aiFeedback: r.aiFeedback ?? "",
                        }));

                        const feedback = await generateGrowthFeedback({ attempts: attempts, assessmentTitle: assessment.title, });
                        setGrowthFeedback(feedback);
                        
                        const resultRef = doc(db, "results", latestResult.id);
                        await updateDoc(resultRef, {
                            growthFeedback: feedback.growthFeedback,
                            growthTeacherGuidance: feedback.teacherGuidance,
                            curricularRemarks: feedback.curricularRemarks,
                            growthFeedbackForAttempts: results.length
                        });
                        toast({ title: "AI 종합 분석 완료", description: "학생의 성장 과정에 대한 종합 분석이 완료되었습니다."});

                    } catch (error) {
                        console.error("Error generating growth feedback:", error);
                        setGrowthFeedback({ 
                            growthFeedback: "성장 피드백 생성 중 오류 발생",
                            teacherGuidance: "교사 조언 생성 중 오류 발생",
                            curricularRemarks: "생활기록부 교과 특기 사항 생성 중 오류 발생"
                         });
                    } finally {
                        setIsLoadingFeedback(false);
                    }
                };
                fetchGrowthFeedback();
            }
        } else {
            setIsLoadingFeedback(false);
        }
    }, [results, assessment.title, toast, latestResult]);

    const RemarksCard = ({ title, content }: { title: string, content?: string }) => (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed min-h-[150px]">
          {isLoadingFeedback ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> 생성 중...</div>
          ) : content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          ) : (
             <div className="text-muted-foreground">오류가 발생했거나 생성된 내용이 없습니다.</div>
          )}
        </CardContent>
      </Card>
    );

    return (
        <div className="space-y-6">
            {!isRubricUsed && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><TrendingUp />성장 곡선</CardTitle>
                        <CardDescription>평가 시도별 점수 변화입니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis domain={[0, 100]} />
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                                <Legend />
                                <Line type="monotone" dataKey="contentScore" name="내용 점수" stroke={chartConfig.contentScore.color} activeDot={{ r: 8 }} />
                                <Line type="monotone" dataKey="pronunciationScore" name="발음 점수" stroke={chartConfig.pronunciationScore.color} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
            {isRubricUsed && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><DraftingCompass />루브릭 영역별 성장 분석</CardTitle>
                        <CardDescription>시도별 루브릭 항목 점수 변화를 비교합니다. (5점 만점)</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarChartData}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" />
                                <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} />
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                                <Legend />
                                {chartData.map((_r, i) => (
                                   <Radar key={i} name={`${i+1}차 시도`} dataKey={`attempt${i+1}`} stroke={`hsl(var(--chart-${(i % 5) + 1}))`} fill={`hsl(var(--chart-${(i % 5) + 1}))`} fillOpacity={0.4} />
                                ))}
                            </RadarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Sparkles />AI 종합 성장 피드백</CardTitle>
                    <CardDescription>모든 시도를 종합하여 AI가 분석한 학생의 성장 과정입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                        <RemarksCard title="생활기록부 교과 특기 사항" content={growthFeedback?.curricularRemarks} />
                        <RemarksCard title="교사용 AI 조언" content={growthFeedback?.teacherGuidance} />
                        <Card className="md:col-span-2">
                            <CardHeader><CardTitle>학생에게 제공된 AI 종합 피드백</CardTitle></CardHeader>
                            <CardContent className="p-4 bg-muted/50 rounded-lg font-body text-base leading-relaxed markdown-content">
                               {isLoadingFeedback ? (
                                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> 생성 중...</div>
                                ) : growthFeedback?.growthFeedback ? (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{growthFeedback.growthFeedback}</ReactMarkdown>
                                ) : (
                                    <div className="text-muted-foreground">오류가 발생했거나 생성된 내용이 없습니다.</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


export default function TeacherStudentResultView() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [student, setStudent] = useState<(typeof mockStudents)[0] | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const studentId = Array.isArray(params.studentId) ? params.studentId[0] : params.studentId;

  const fetchStudentResults = useCallback(async () => {
    if (!assessmentId || !studentId) return;
    setIsLoading(true);
    try {
      const resultsQuery = query(
        collection(db, "results"),
        where("assessmentId", "==", assessmentId),
        where("studentId", "==", studentId)
      );
      const querySnapshot = await getDocs(resultsQuery);
      if (querySnapshot.empty) {
        toast({ title: "결과 없음", description: "해당 학생의 평가 결과가 없습니다.", variant: "destructive" });
        router.push(`/teacher/assessment/${assessmentId}`);
        return;
      }
      const studentResults = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as StudentResult))
        .sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0)); // Sort client-side
      
      setResults(studentResults);

    } catch (error) {
      console.error("Error fetching student results:", error);
      toast({ title: "오류", description: "학생 결과를 불러오는 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [assessmentId, studentId, router, toast]);

  useEffect(() => {
    if (authLoading || !user) return;
    
    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const assessmentRef = doc(db, "assessments", assessmentId);
            const assessmentSnap = await getDoc(assessmentRef);
          
            if (!assessmentSnap.exists() || assessmentSnap.data().uid !== user.uid) {
                toast({ title: "오류", description: "평가를 찾을 수 없거나 접근 권한이 없습니다.", variant: "destructive" });
                notFound();
                return;
            }
            setAssessment({ id: assessmentSnap.id, ...assessmentSnap.data() } as TeacherAssessment);
    
            const foundStudent = mockStudents.find(s => s.uid === studentId);
            if (foundStudent) {
                setStudent(foundStudent);
            } else {
                toast({ title: "오류", description: "학생 정보를 찾을 수 없습니다.", variant: "destructive" });
                notFound();
                return;
            }

            await fetchStudentResults();

        } catch (error) {
             console.error("Error fetching initial data:", error);
             toast({ title: "오류", description: "데이터를 불러오는 중 오류가 발생했습니다.", variant: "destructive" });
             notFound();
        } finally {
            setIsLoading(false);
        }
    };

    fetchInitialData();
  }, [studentId, assessmentId, user, toast, router, authLoading, fetchStudentResults]);
  

  if (isLoading || authLoading || !assessment || !student) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  const completedResults = results.filter(r => r.status === "채점 완료");
  const hasMultipleAttempts = completedResults.length > 1;

  if (completedResults.length === 0) {
      return (
        <Card>
            <CardHeader>
                <CardTitle>{student.displayName} 학생의 결과</CardTitle>
                <CardDescription>'{assessment.title}'</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12">
                <p className="text-muted-foreground">이 학생의 완료된 평가 결과가 없습니다.</p>
                <p className="text-sm text-muted-foreground">오류가 있거나 채점 중인 결과는 있을 수 있습니다.</p>
            </CardContent>
        </Card>
      )
  }

  return (
    <div className="space-y-6">
       <Card>
          <CardHeader className="flex-row items-center gap-4 space-y-0">
             <Avatar className="h-16 w-16">
               <AvatarImage src={student.photoURL || ""} alt={student.displayName || "Student"} />
               <AvatarFallback>{student.displayName?.charAt(0) || "S"}</AvatarFallback>
             </Avatar>
             <div>
                 <CardTitle className="text-2xl">{student.displayName}</CardTitle>
                 <CardDescription>'{assessment.title}' 평가 결과 ({completedResults.length}회 응시)</CardDescription>
             </div>
          </CardHeader>
       </Card>

       <Tabs defaultValue={hasMultipleAttempts ? "overview" : `attempt-${completedResults.length}`} className="w-full">
         <TabsList>
           {hasMultipleAttempts && <TabsTrigger value="overview">종합 분석</TabsTrigger>}
           {completedResults.map((result, index) => (
             <TabsTrigger key={result.id} value={`attempt-${index + 1}`}>{index + 1}차 시도</TabsTrigger>
           ))}
         </TabsList>
         
         {hasMultipleAttempts && (
            <TabsContent value="overview" className="mt-4">
                <TeacherGrowthView results={completedResults} assessment={assessment} />
            </TabsContent>
         )}

         {completedResults.map((result, index) => (
           <TabsContent key={result.id} value={`attempt-${index + 1}`} className="mt-4">
             <AttemptDetailView result={result} assessment={assessment} attemptNumber={index + 1} />
           </TabsContent>
         ))}
       </Tabs>
    </div>
  );
}
