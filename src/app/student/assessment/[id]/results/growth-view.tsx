
"use client"

import { useState, useEffect } from "react";
import { type StudentResult, type TeacherAssessment } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { FeedbackView } from "./feedback-view";
import { FreeTalkFeedbackView } from "../../free-talk/results/free-talk-feedback-view";
import { Loader2, Sparkles, TrendingUp, DraftingCompass } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Repeat } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from "remark-gfm";

// Note: This component is being reverted to a state before the full growth analysis feature.
// The AI flow call is removed for now to ensure stability.

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
    const chartData = results.map((r, i) => ({
        name: `${i + 1}차`,
        contentScore: r.contentScore ?? 0,
        pronunciationScore: r.pronunciationScore ?? 0,
    }));

    const isRubricUsed = results.some(r => !!r.rubricScores);
    const isDialogue = assessment.assessmentType === 'dialogue';
    
    const rubricSubjects = isDialogue 
        ? ['유창성', '발음', '문법', '어휘', '상호작용']
        : ['유창성', '발음', '문법', '어휘'];

    const radarChartData = rubricSubjects.map(subject => {
        const entry: { [key: string]: string | number } = { subject };
        results.forEach((r, i) => {
            const key = `attempt${i + 1}`;
            if (r.rubricScores) {
                switch(subject) {
                    case '유창성': entry[key] = r.rubricScores.fluency; break;
                    case '발음': entry[key] = r.rubricScores.pronunciation; break;
                    case '문법': entry[key] = r.rubricScores.grammar; break;
                    case '어휘': entry[key] = r.rubricScores.vocabulary; break;
                    case '상호작용': entry[key] = r.rubricScores.interaction || 0; break;
                }
            } else {
                 entry[key] = 0;
            }
        });
        return entry;
    });
    
    const retryLink = assessment.assessmentType === 'dialogue'
        ? `/student/assessment/free-talk?id=${assessment.id}`
        : `/student/assessment/${assessment.id}`;

    const renderFeedbackComponent = (result: StudentResult, isLatest: boolean) => {
        if (assessment.assessmentType === 'dialogue') {
            return <FreeTalkFeedbackView result={result} assessment={assessment} isLatestAttempt={isLatest} />;
        }
        return <FeedbackView result={result} assessment={assessment} isLatestAttempt={isLatest} />;
    };

    return (
        <Tabs defaultValue={defaultTab || `attempt-${results.length}`} className="w-full">
            <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="overview">종합 분석</TabsTrigger>
                {results.map((result, index) => (
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
                                    {results.map((r, i) => (
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

            {results.map((result, index) => (
                <TabsContent key={result.id} value={`attempt-${index + 1}`}>
                    {renderFeedbackComponent(result, index === results.length - 1)}
                </TabsContent>
            ))}
        </Tabs>
    );
}
