
"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { type StudentResult, type TeacherAssessment } from "@/lib/types";
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { Loader2, ChevronDown, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';


type EnrichedResult = StudentResult & {
    assessmentType?: 'monologue' | 'dialogue';
};

type GroupedResult = {
  assessmentId: string;
  assessmentTitle: string;
  assessmentType?: 'monologue' | 'dialogue';
  latestAttempt: EnrichedResult;
  previousAttempts: EnrichedResult[];
  totalAttempts: number;
};


export default function HistoryPage() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [groupedAssessments, setGroupedAssessments] = useState<GroupedResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/');
      return;
    }

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const assessmentsQuery = getDocs(collection(db, "assessments"));
            
            const resultsQuery = getDocs(query(
                collection(db, "results"),
                where("studentId", "==", user.uid)
            ));
            
            const [assessmentsSnapshot, resultsSnapshot] = await Promise.all([assessmentsQuery, resultsQuery]);
            
            const assessmentsMap = new Map<string, TeacherAssessment>();
            assessmentsSnapshot.forEach(doc => {
                assessmentsMap.set(doc.id, { id: doc.id, ...doc.data() } as TeacherAssessment);
            });

            const allResults: EnrichedResult[] = resultsSnapshot.docs.map(doc => {
                const result = { id: doc.id, ...doc.data() } as StudentResult;
                const assessment = assessmentsMap.get(result.assessmentId);
                return {
                    ...result,
                    assessmentType: assessment?.assessmentType || 'monologue',
                };
            });
            
            const completedResults = allResults
                .filter(result => result.status === "채점 완료")
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            const resultsByAssessmentId: { [key: string]: EnrichedResult[] } = {};
            completedResults.forEach(result => {
                if (!resultsByAssessmentId[result.assessmentId]) {
                    resultsByAssessmentId[result.assessmentId] = [];
                }
                resultsByAssessmentId[result.assessmentId].push(result);
            });

            const grouped: GroupedResult[] = Object.values(resultsByAssessmentId).map(attempts => {
                const latestAttempt = attempts[0];
                const previousAttempts = attempts.slice(1);
                return {
                    assessmentId: latestAttempt.assessmentId,
                    assessmentTitle: latestAttempt.assessmentTitle,
                    assessmentType: latestAttempt.assessmentType,
                    latestAttempt: latestAttempt,
                    previousAttempts: previousAttempts.reverse(),
                    totalAttempts: attempts.length,
                };
            });
            
            grouped.sort((a,b) => (b.latestAttempt.createdAt || 0) - (a.latestAttempt.createdAt || 0));

            setGroupedAssessments(grouped);
        } catch (error) {
            console.error("Error fetching history: ", error);
        } finally {
            setIsLoading(false);
        }
    };

    fetchHistory();
  }, [user, authLoading, router]);
  
  const toggleGroup = (assessmentId: string) => {
    setOpenStates(prev => ({ ...prev, [assessmentId]: !prev[assessmentId] }));
  };

  if (isLoading || authLoading) {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }
  
  const getAssessmentTypeText = (assessmentType?: 'monologue' | 'dialogue') => {
      if (assessmentType === 'dialogue') {
          return t.teacherAssessments.assessmentTypes.dialogue;
      }
      return t.teacherAssessments.assessmentTypes.monologue;
  }

  const getResultLink = (result: EnrichedResult, attemptNumber?: number) => {
    const baseLink = result.assessmentType === 'dialogue' 
        ? `/student/assessment/free-talk/results?id=${result.assessmentId}`
        : `/student/assessment/${result.assessmentId}/results`;

    if (attemptNumber) {
        return `${baseLink}&attempt=${attemptNumber}`;
    }
    return baseLink;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.studentHistory.title}</CardTitle>
        <CardDescription>{t.studentHistory.description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[40%] pl-4">{t.studentHistory.assessment}</TableHead>
                    <TableHead className="text-center whitespace-nowrap">평가 유형</TableHead>
                    <TableHead className="text-center whitespace-nowrap">완료 날짜</TableHead>
                    <TableHead className="text-center whitespace-nowrap">내용 점수</TableHead>
                    <TableHead className="text-center whitespace-nowrap">발음 점수</TableHead>
                    <TableHead className="text-center pr-4">결과 보기</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {groupedAssessments.length > 0 ? (
                    groupedAssessments.map((group, groupIndex) => {
                        const isExpanded = !!openStates[group.assessmentId];
                        return (
                            <React.Fragment key={group.assessmentId}>
                                 <TableRow className={cn("font-medium align-middle", !isExpanded && groupIndex === groupedAssessments.length - 1 && 'border-b-0', isExpanded && 'border-b-2 border-dashed')}>
                                    <TableCell className="pl-4">
                                        <div className="flex items-center gap-2">
                                            {group.totalAttempts > 1 ? (
                                                <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={() => toggleGroup(group.assessmentId)}>
                                                    <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                                    <span className="sr-only">Toggle</span>
                                                </Button>
                                            ) : (
                                                <div className="w-8 h-8 p-0"/> 
                                            )}
                                            <span className="font-semibold break-words">{group.assessmentTitle}</span>
                                            {group.totalAttempts > 1 && <Badge variant="outline" className="flex justify-center">총 {group.totalAttempts}회 응시</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="whitespace-nowrap">{getAssessmentTypeText(group.assessmentType)}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center whitespace-nowrap">{group.latestAttempt.createdAt ? format(new Date(group.latestAttempt.createdAt), 'yyyy-MM-dd') : 'N/A'}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="whitespace-nowrap">{group.latestAttempt.contentScore ?? group.latestAttempt.score ?? 0}%</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="whitespace-nowrap">{group.latestAttempt.pronunciationScore ?? 0}%</Badge>
                                    </TableCell>
                                    <TableCell className="text-center pr-4">
                                        <Link href={getResultLink(group.latestAttempt, group.totalAttempts > 1 ? group.totalAttempts : undefined)}>
                                            <Button variant="secondary" size="sm">
                                                {group.totalAttempts > 1 ? <TrendingUp className="mr-2 h-4 w-4" /> : null}
                                                {group.totalAttempts > 1 ? "종합 분석 보기" : "결과 보기"}
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                                {isExpanded && group.previousAttempts.map((attempt, index) => (
                                     <TableRow key={attempt.id} className={cn("bg-muted/50 border-dashed",
                                       index === group.previousAttempts.length - 1 ? 'border-b-2' : 'border-b'
                                     )}>
                                        <TableCell className="pl-12 text-muted-foreground">
                                          └ {index + 1}차 시도
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="ghost" className="whitespace-nowrap">{getAssessmentTypeText(attempt.assessmentType)}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center text-muted-foreground whitespace-nowrap">
                                            {attempt.createdAt ? format(new Date(attempt.createdAt), 'yyyy-MM-dd') : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="ghost" className="whitespace-nowrap">{attempt.contentScore ?? attempt.score ?? 0}%</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="ghost" className="whitespace-nowrap">{attempt.pronunciationScore ?? 0}%</Badge>
                                        </TableCell>
                                        <TableCell className="text-center pr-4">
                                            <Link href={getResultLink(attempt, index + 1)}>
                                                <Button variant="ghost" size="sm">결과 보기</Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        );
                    })
                ) : (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            완료된 평가가 없습니다.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
