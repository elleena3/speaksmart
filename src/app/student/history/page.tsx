
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { type StudentResult, type TeacherAssessment } from '@/lib/types';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useEffect, useState } from 'react';
import { Loader2, ChevronDown, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';


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
                where("studentId", "==", user.uid),
                where("status", "==", "채점 완료")
            ));

            const [assessmentsSnapshot, resultsSnapshot] = await Promise.all([assessmentsQuery, resultsQuery]);
            
            const assessmentsMap = new Map<string, TeacherAssessment>();
            assessmentsSnapshot.forEach(doc => {
                assessmentsMap.set(doc.id, { id: doc.id, ...doc.data() } as TeacherAssessment);
            });

            const resultsByAssessmentId: { [key: string]: EnrichedResult[] } = {};
            resultsSnapshot.docs.forEach(doc => {
                const result = { id: doc.id, ...doc.data() } as StudentResult;
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
                attempts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // Newest first
                const latestAttempt = attempts[0];
                const previousAttempts = attempts.slice(1);
                return {
                    assessmentId: latestAttempt.assessmentId,
                    assessmentTitle: latestAttempt.assessmentTitle,
                    assessmentType: latestAttempt.assessmentType,
                    latestAttempt: latestAttempt,
                    previousAttempts: previousAttempts,
                    totalAttempts: attempts.length,
                };
            });

            grouped.sort((a, b) => (b.latestAttempt.createdAt || 0) - (a.latestAttempt.createdAt || 0));
            
            setGroupedAssessments(grouped);
        } catch (error) {
            console.error("Error fetching history: ", error);
        } finally {
            setIsLoading(false);
        }
    };

    fetchHistory();
  }, [user, authLoading, router]);

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

  const getResultLink = (result: EnrichedResult, isLatest: boolean, totalAttempts: number) => {
    const baseLink = `/student/assessment/${result.assessmentId}/results`;
    if (isLatest && totalAttempts > 1) {
      return baseLink; 
    }
    const attemptNumber = groupedAssessments
        .find(g => g.assessmentId === result.assessmentId)
        ?.previousAttempts.findIndex(p => p.id === result.id);
        
    return `${baseLink}?attempt=${totalAttempts - (attemptNumber ?? 0)}`;
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
                    <TableHead className="w-[40%] text-center">{t.studentHistory.assessment}</TableHead>
                    <TableHead className="text-center">평가 유형</TableHead>
                    <TableHead className="text-center">완료 날짜</TableHead>
                    <TableHead className="text-center">내용 점수</TableHead>
                    <TableHead className="text-center">발음 점수</TableHead>
                    <TableHead className="text-center">{t.studentHistory.viewFeedback}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {groupedAssessments.length > 0 ? (
                    groupedAssessments.map((group, groupIndex) => (
                        <Collapsible asChild key={group.assessmentId}>
                            <>
                                <TableRow className="font-medium align-middle">
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {group.totalAttempts > 1 && (
                                                <CollapsibleTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0 data-[state=open]:rotate-180">
                                                        <ChevronDown className="h-4 w-4" />
                                                        <span className="sr-only">Toggle</span>
                                                    </Button>
                                                </CollapsibleTrigger>
                                            )}
                                            <span className={cn("font-semibold", group.totalAttempts <= 1 && "pl-8")}>{group.assessmentTitle}</span>
                                            {group.totalAttempts > 1 && <Badge variant="outline">총 {group.totalAttempts}회 응시</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="whitespace-nowrap">{getAssessmentTypeText(group.assessmentType)}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center whitespace-nowrap">{group.latestAttempt.createdAt ? format(new Date(group.latestAttempt.createdAt), 'yyyy-MM-dd') : 'N/A'}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline">{group.latestAttempt.contentScore ?? group.latestAttempt.score ?? 0}%</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline">{group.latestAttempt.pronunciationScore ?? 0}%</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Link href={getResultLink(group.latestAttempt, true, group.totalAttempts)}>
                                            <Button variant="secondary" size="sm">
                                                {group.totalAttempts > 1 ? <TrendingUp className="mr-2 h-4 w-4" /> : null}
                                                {group.totalAttempts > 1 ? "종합 분석 보기" : "결과 보기"}
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                                <CollapsibleContent asChild>
                                    <>
                                      {group.previousAttempts.map((attempt, index) => (
                                          <TableRow key={attempt.id} className={cn("bg-muted/50", (index < group.previousAttempts.length - 1) && "border-b-dashed")}>
                                              <TableCell className="text-center pl-12 text-muted-foreground">
                                                └ {group.totalAttempts - 1 - index}차 시도
                                              </TableCell>
                                              <TableCell className="text-center">
                                                  <Badge variant="ghost" className="whitespace-nowrap">{getAssessmentTypeText(attempt.assessmentType)}</Badge>
                                              </TableCell>
                                              <TableCell className="text-center text-muted-foreground whitespace-nowrap">
                                                  {attempt.createdAt ? format(new Date(attempt.createdAt), 'yyyy-MM-dd') : 'N/A'}
                                              </TableCell>
                                              <TableCell className="text-center">
                                                  <Badge variant="ghost">{attempt.contentScore ?? attempt.score ?? 0}%</Badge>
                                              </TableCell>
                                              <TableCell className="text-center">
                                                  <Badge variant="ghost">{attempt.pronunciationScore ?? 0}%</Badge>
                                              </TableCell>
                                              <TableCell className="text-center">
                                                  <Link href={`/student/assessment/${attempt.assessmentId}/results?attempt=${group.totalAttempts - 1 - index}`}>
                                                      <Button variant="ghost" size="sm">결과 보기</Button>
                                                  </Link>
                                              </TableCell>
                                          </TableRow>
                                      ))}
                                    </>
                                </CollapsibleContent>
                             </>
                        </Collapsible>
                    ))
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
