
"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { type StudentResult, type TeacherAssessment } from '@/lib/types';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { Loader2, ChevronDown, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
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

            // **쿼리 단순화:** 복합 색인 오류를 피하기 위해 studentId로만 필터링합니다.
            // 정렬과 추가 필터링은 클라이언트 측에서 수행합니다.
            const resultsQuery = getDocs(query(
                collection(db, "results"),
                where("studentId", "==", user.uid)
            ));

            const [assessmentsSnapshot, resultsSnapshot] = await Promise.all([assessmentsQuery, resultsQuery]);
            
            const assessmentsMap = new Map<string, TeacherAssessment>();
            assessmentsSnapshot.forEach(doc => {
                assessmentsMap.set(doc.id, { id: doc.id, ...doc.data() } as TeacherAssessment);
            });

            // **클라이언트 측 필터링 및 정렬:**
            const completedResults = resultsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as StudentResult))
                .filter(result => result.status === "채점 완료")
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // 최신순으로 정렬

            const resultsByAssessmentId: { [key: string]: EnrichedResult[] } = {};
            completedResults.forEach(result => {
                const assessment = assessmentsMap.get(result.assessmentId);
                const enrichedResult: EnrichedResult = {
                    ...result,
                    assessmentType: assessment?.assessmentType || 'monologue',
                };
                if (!resultsByAssessmentId[result.assessmentId]) {
                    resultsByAssessmentId[result.assessmentId] = [];
                }
                resultsByAssessmentId[result.assessmentId].push(enrichedResult);
            });

            const grouped: GroupedResult[] = Object.values(resultsByAssessmentId).map(attempts => {
                // 이미 클라이언트 측에서 시간순으로 정렬(desc)했으므로 첫 번째 항목이 최신 시도입니다.
                const latestAttempt = attempts[0];
                const previousAttempts = attempts.slice(1);
                return {
                    assessmentId: latestAttempt.assessmentId,
                    assessmentTitle: latestAttempt.assessmentTitle,
                    assessmentType: latestAttempt.assessmentType,
                    latestAttempt: latestAttempt,
                    previousAttempts: previousAttempts.reverse(), // 확장 시에는 가장 오래된 시도가 먼저 보이도록 순서를 뒤집습니다.
                    totalAttempts: attempts.length,
                };
            });
            
            // 최신 시도의 생성 날짜를 기준으로 그룹 자체를 정렬합니다.
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

  const getResultLink = (result: EnrichedResult) => {
    return `/student/assessment/${result.assessmentId}/results`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.studentHistory.title}</CardTitle>
        <CardDescription>{t.studentHistory.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[40%]">{t.studentHistory.assessment}</TableHead>
                    <TableHead className="text-center">평가 유형</TableHead>
                    <TableHead className="text-center">완료 날짜</TableHead>
                    <TableHead className="text-center">내용 점수</TableHead>
                    <TableHead className="text-center">발음 점수</TableHead>
                    <TableHead className="text-center">{t.studentHistory.viewFeedback}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {groupedAssessments.length > 0 ? (
                    groupedAssessments.map((group, groupIndex) => {
                        const isExpanded = openStates[group.assessmentId];
                        return (
                            <React.Fragment key={group.assessmentId}>
                                 <TableRow className={cn("font-medium align-middle", groupIndex === groupedAssessments.length - 1 && !isExpanded ? 'border-b-0' : '')}>
                                    <TableCell>
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
                                            {group.totalAttempts > 1 && <Badge variant="outline">총 {group.totalAttempts}회 응시</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="whitespace-nowrap">{getAssessmentTypeText(group.assessmentType)}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center whitespace-nowrap">{group.latestAttempt.createdAt ? format(new Date(group.latestAttempt.createdAt), 'yyyy-MM-dd') : 'N/A'}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline">{group.latestAttempt.score ?? 0}%</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline">{group.latestAttempt.pronunciationScore ?? 0}%</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Link href={getResultLink(group.latestAttempt)}>
                                            <Button variant="secondary" size="sm">
                                                {group.totalAttempts > 1 ? <TrendingUp className="mr-2 h-4 w-4" /> : null}
                                                {group.totalAttempts > 1 ? "종합 분석 보기" : "결과 보기"}
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                                {isExpanded && group.previousAttempts.map((attempt, index) => (
                                     <TableRow key={attempt.id} className={cn(
                                        "bg-muted/50 border-dashed",
                                        (groupIndex === groupedAssessments.length - 1 && index === group.previousAttempts.length - 1) ? 'border-b-0' : 'border-b'
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
                                            <Badge variant="ghost">{attempt.score ?? 0}%</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="ghost">{attempt.pronunciationScore ?? 0}%</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Link href={`${getResultLink(attempt)}?attempt=${index + 1}`}>
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
