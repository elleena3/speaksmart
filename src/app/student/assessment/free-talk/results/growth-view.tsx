
"use client"

import { useState, useEffect } from "react";
import { type StudentResult, type TeacherAssessment, type ResultSummary } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { FreeTalkFeedbackView } from "./free-talk-feedback-view";
import { generateGrowthFeedback, type GenerateGrowthFeedbackOutput } from "@/ai/flows/generate-growth-feedback-flow";
import { Loader2, Sparkles, TrendingUp, DraftingCompass } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Repeat } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from "remark-gfm";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

type GrowthViewProps = {
    results: StudentResult[];
    assessment: TeacherAssessment;
    defaultTab?: string;
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

export function GrowthView({ results, assessment, defaultTab }: GrowthViewProps) {
    const [growthFeedback, setGrowthFeedback] = useState<GenerateGrowthFeedbackOutput | null>(null);
    const [isLoadingFeedback, setIsLoadingFeedback] = useState(true);
    const { toast } = useToast();

    const sortedResults = results;
    const latestResult = sortedResults[sortedResults.length - 1];

    const chartData = latestResult.historicalScores 
        ? latestResult.historicalScores.map(hs => ({
            name: `${hs.attempt}차`,
            contentScore: hs.contentScore,
            pronunciationScore: hs.pronunciationScore,
          }))
        : [];

    const isRubricUsed = latestResult.historicalScores?.some(r => !!r.rubricScores);
    
    const rubricSubjects = assessment.assessmentType === 'dialogue'
        ? ['유창성', '발음', '문법', '어휘', '상호작용']
        : ['유창성', '발음', '문법', '어휘'];

    const radarChartData = rubricSubjects.map(subject => {
        const entry: { [key: string]: string | number } = { subject };
        latestResult.historicalScores?.forEach((hs, i) => {
            const key = `attempt${i + 1}`;
            if (hs.rubricScores) {
                switch(subject) {
                    case '유창성': entry[key] = hs.rubricScores.fluency; break;
                    case '발음': entry[key] = hs.rubricScores.pronunciation; break;
                    case '문법': entry[key] = hs.rubricScores.grammar; break;
                    case '어휘': entry[key] = hs.rubricScores.vocabulary; break;
                    case '상호작용': entry[key] = hs.rubricScores.interaction || 0; break;
                }
            } else {
                 entry[key] = 0;
            }
        });
        return entry;
    });

    useEffect(() => {
        if (sortedResults.length > 1) {
            if (latestResult.growthFeedback && latestResult.growthFeedbackForAttempts === sortedResults.length) {
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
                        const attempts: ResultSummary[] = sortedResults.map((r, index) => ({
                          attemptNumber: index + 1,
                          contentScore: r.contentScore ?? 0,
                          pronunciationScore: r.pronunciationScore ?? 0,
                          transcript: r.studentTranscript ?? "",
                          aiFeedback: r.aiFeedback ?? "",
                        }));

                        const feedback = await generateGrowthFeedback({
                            attempts: attempts,
                            assessmentTitle: assessment.title,
                        });
                        setGrowthFeedback(feedback);
                        
                        const resultRef = doc(db, "results", latestResult.id);
                        await updateDoc(resultRef, {
                            growthFeedback: feedback.growthFeedback,
                            growthTeacherGuidance: feedback.teacherGuidance,
                            growthCurricularRemarks: feedback.curricularRemarks,
                            growthFeedbackForAttempts: sortedResults.length
                        });
                        toast({ title: "AI 종합 분석 완료", description: "학생의 성장 과정에 대한 종합 분석이 완료되었습니다."});

                    } catch (error) {
                        console.error("Error generating growth feedback:", error);
                         setGrowthFeedback({ 
                            growthFeedback: "성장 피드백을 생성하는 중 오류가 발생했습니다.",
                            teacherGuidance: "교사 조언을 생성하는 중 오류가 발생했습니다.",
                            curricularRemarks: "교과과정 비고를 생성하는 중 오류가 발생했습니다."
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
    }, [sortedResults, assessment.title, toast, latestResult]);
    
    const retryLink = assessment.assessmentType === 'dialogue'
        ? `/student/assessment/free-talk?id=${assessment.id}`
        : `/student/assessment/${assessment.id}`;

    return (
        <Tabs defaultValue={defaultTab || `attempt-${sortedResults.length}`} className="w-full">
            <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="overview">종합 분석</TabsTrigger>
                {sortedResults.map((result, index) => (
                    <TabsTrigger key={result.id} value={`attempt-${index + 1}`}>{index + 1}차 시도</TabsTrigger>
                ))}
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-6">
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
                                    {latestResult.historicalScores?.map((r, i) => (
                                       <Radar 
                                         key={i} 
                                         name={`${i+1}차 시도`} 
                                         dataKey={`attempt${i+1}`} 
                                         stroke={`hsl(var(--chart-${(i % 5) + 1}))`} 
                                         fill={`hsl(var(--chart-${(i % 5) + 1}))`} 
                                         fillOpacity={0.4} 
                                        />
                                    ))}
                                </RadarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}
                {sortedResults.length > 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Sparkles />AI 종합 성장 피드백</CardTitle>
                            <CardDescription>모든 시도를 종합하여 AI가 분석한 학생의 성장 과정입니다.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoadingFeedback ? (
                                <div className="flex items-center justify-center p-8">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : (
                                <div className="p-4 bg-muted/50 rounded-lg markdown-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {growthFeedback?.growthFeedback || ''}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
                 <Card>
                    <CardHeader>
                      <CardTitle>다시 해보기</CardTitle>
                      <CardDescription>이 평가에 다시 도전하여 실력을 향상시켜 보세요.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link href={retryLink} passHref>
                        <Button className="w-full">
                          <Repeat className="mr-2 h-4 w-4" /> 다시 해보기
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
            </TabsContent>

            {sortedResults.map((result, index) => (
                <TabsContent key={result.id} value={`attempt-${index + 1}`}>
                    <FreeTalkFeedbackView result={result} assessment={assessment} isLatestAttempt={index === sortedResults.length - 1} />
                </TabsContent>
            ))}
        </Tabs>
    );
}
