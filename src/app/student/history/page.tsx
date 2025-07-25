
"use client";

import React, { useEffect, useState, useCallback } from 'react';
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
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [groupedAssessments, setGroupedAssessments] = useState<GroupedResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    if (!db) {
        toast({
            title: "설정 오류",
            description: "Firebase 데이터베이스가 설정되지 않았습니다. 기록을 볼 수 없습니다.",
            variant: "destructive",
        });
        setIsLoading(false);
        return;
    }

    try {
        // 1. Fetch student results and all assessments in parallel
        const resultsQuery = query(collection(db, "results"), where("studentId", "==", user.uid));
        const assessmentsQuery = query(collection(db, "assessments"));

        const [resultsSnapshot, assessmentsSnapshot] = await Promise.all([
            getDocs(resultsQuery),
            getDocs(assessmentsQuery)
        ]);
        
        // 2. Create a Set of valid assessment IDs for quick lookup
        const validAssessmentIds = new Set<string>();
        const assessmentsMap = new Map<string, TeacherAssessment>();
        assessmentsSnapshot.forEach(doc => {
            validAssessmentIds.add(doc.id);
            assessmentsMap.set(doc.id, { id: doc.id, ...doc.data() } as TeacherAssessment);
        });

        // 3. Filter student results on the client-side
        const studentResults = resultsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as StudentResult))
            .filter(result => 
                result.status === "채점 완료" && // Must be completed
                validAssessmentIds.has(result.assessmentId) // And must have a valid parent assessment
            );

        const resultsByAssessmentId: { [key: string]: StudentResult[] } = {};
        for (const result of studentResults) {
            if (!resultsByAssessmentId[result.assessmentId]) {
                resultsByAssessmentId[result.assessmentId] = [];
            }
            resultsByAssessmentId[result.assessmentId].push(result);
        }
        
        const grouped: GroupedResult[] = Object.entries(resultsByAssessmentId).map(([assessmentId, attempts]) => {
            const assessmentDetails = assessmentsMap.get(assessmentId);
            // Sort attempts by date descending to find the latest one
            attempts.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));

            const latestAttempt = attempts[0]; 
            const previousAttempts = attempts.slice(1);
            
            return {
                assessmentId: latestAttempt.assessmentId,
                assessmentTitle: assessmentDetails?.title || latestAttempt.assessmentTitle || "제목 없음",
                assessmentType: assessmentDetails?.assessmentType || 'monologue',
                latestAttempt: { ...latestAttempt, assessmentType: assessmentDetails?.assessmentType },
                // Reverse previous attempts to show them in chronological order (1st, 2nd...)
                previousAttempts: previousAttempts.map(p => ({ ...p, assessmentType: assessmentDetails?.assessmentType })).reverse(),
                totalAttempts: attempts.length,
            };
        }).filter(group => group.totalAttempts > 0);

        // Sort the final list of assessments by the latest attempt's creation date
        grouped.sort((a,b) => (b.latestAttempt.createdAt || 0) - (a.latestAttempt.createdAt || 0));
        
        setGroupedAssessments(grouped);

    } catch (error) {
        console.error("Error fetching history: ", error);
        toast({
            title: "기록 조회 오류",
            description: "평가 기록을 불러오는 중 오류가 발생했습니다.",
            variant: "destructive",
        });
    } finally {
        setIsLoading(false);
    }
  }, [user, toast]);


  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/');
      return;
    }
    fetchHistory();
  }, [user, authLoading, router, fetchHistory]);
  
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
      if (!assessmentType) return 'N/A';
      if (assessmentType === 'dialogue') {
          return t.teacherAssessments.assessmentTypes.dialogue;
      }
      return t.teacherAssessments.assessmentTypes.monologue;
  }

  const getResultLink = (result: EnrichedResult, isLatest: boolean, totalAttempts: number) => {
    const attemptNumber = isLatest ? totalAttempts : groupedAssessments.find(g => g.assessmentId === result.assessmentId)?.previousAttempts.findIndex(p => p.id === result.id)! + 1;
    
    let baseLink = '';
    let params = new URLSearchParams();

    if (result.assessmentType === 'dialogue') {
      baseLink = `/student/assessment/free-talk/results`;
      params.append('id', result.assessmentId);
    } else {
      baseLink = `/student/assessment/${result.assessmentId}/results`;
    }

    if (totalAttempts > 1) {
      params.append('attempt', attemptNumber.toString());
    }

    const queryString = params.toString();
    return queryString ? `${baseLink}?${queryString}` : baseLink;
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
                    <TableHead className="w-[40%] text-center">{t.studentHistory.assessment}</TableHead>
                    <TableHead className="text-center whitespace-nowrap">{t.studentHistory.assessmentType}</TableHead>
                    <TableHead className="text-center whitespace-nowrap">{t.studentHistory.completionDate}</TableHead>
                    <TableHead className="text-center whitespace-nowrap">{t.studentHistory.contentScore}</TableHead>
                    <TableHead className="text-center whitespace-nowrap">{t.studentHistory.pronunciationScore}</TableHead>
                    <TableHead className="text-center pr-4">{t.studentHistory.action}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {groupedAssessments.length > 0 ? (
                    groupedAssessments.map((group) => {
                        const isExpanded = !!openStates[group.assessmentId];
                        return (
                            <React.Fragment key={group.assessmentId}>
                                 <TableRow className={cn("font-medium align-middle", isExpanded && 'border-b-2 border-dashed')}>
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
                                            <span className="font-semibold break-words">{group.assessmentTitle || '제목 없음'}</span>
                                            {group.totalAttempts > 1 && <Badge variant="outline" className="flex justify-center">총 {group.totalAttempts}회 응시</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="whitespace-nowrap">{getAssessmentTypeText(group.assessmentType)}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center whitespace-nowrap">{group.latestAttempt.createdAt ? format(new Date(group.latestAttempt.createdAt), 'yyyy-MM-dd') : 'N/A'}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="whitespace-nowrap">{group.latestAttempt.contentScore ?? 0}%</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="whitespace-nowrap">{group.latestAttempt.pronunciationScore ?? 0}%</Badge>
                                    </TableCell>
                                    <TableCell className="text-center pr-4">
                                        <Link href={getResultLink(group.latestAttempt, true, group.totalAttempts)}>
                                            <Button variant="secondary" size="sm">
                                                {group.totalAttempts > 1 ? <TrendingUp className="mr-2 h-4 w-4" /> : null}
                                                {group.totalAttempts > 1 ? "종합 분석 보기" : t.studentHistory.action}
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                                {isExpanded && group.previousAttempts.map((attempt, index) => (
                                     <TableRow key={attempt.id} className={cn("bg-muted/50",
                                       index === group.previousAttempts.length - 1 ? 'border-b-2 border-dashed' : 'border-b border-dashed'
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
                                            <Badge variant="ghost" className="whitespace-nowrap">{attempt.contentScore ?? 0}%</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="ghost" className="whitespace-nowrap">{attempt.pronunciationScore ?? 0}%</Badge>
                                        </TableCell>
                                        <TableCell className="text-center pr-4">
                                            <Link href={getResultLink(attempt, false, group.totalAttempts)}>
                                                <Button variant="ghost" size="sm">{t.studentHistory.action}</Button>
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
                            {t.studentHistory.noResults}
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

    