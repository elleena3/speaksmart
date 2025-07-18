
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { type StudentResult, type TeacherAssessment } from '@/lib/types';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useEffect, useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type EnrichedResult = StudentResult & {
    assessmentType?: 'monologue' | 'dialogue';
    attemptNumber?: number;
    totalAttempts?: number;
};

export default function HistoryPage() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [completedAssessments, setCompletedAssessments] = useState<EnrichedResult[]>([]);
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
            // Fetch all assessments and results in parallel
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

            let allResults = resultsSnapshot.docs.map(doc => {
                const result = { id: doc.id, ...doc.data() } as StudentResult;
                const assessment = assessmentsMap.get(result.assessmentId);
                return {
                    ...result,
                    assessmentType: assessment?.assessmentType || 'monologue',
                };
            });

            // Group results by assessmentId
            const groupedResults: { [key: string]: EnrichedResult[] } = {};
            allResults.forEach(result => {
                if (!groupedResults[result.assessmentId]) {
                    groupedResults[result.assessmentId] = [];
                }
                groupedResults[result.assessmentId].push(result);
            });

            const enrichedResults: EnrichedResult[] = [];
            for (const assessmentId in groupedResults) {
                const attempts = groupedResults[assessmentId].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
                const totalAttempts = attempts.length;
                attempts.forEach((attempt, index) => {
                    enrichedResults.push({
                        ...attempt,
                        attemptNumber: index + 1,
                        totalAttempts: totalAttempts,
                    });
                });
            }

            // Sort the final list by date (newest first), then by assessmentId, then by attempt number
            enrichedResults.sort((a, b) => {
                if (b.createdAt !== a.createdAt) {
                    return (b.createdAt || 0) - (a.createdAt || 0);
                }
                if (a.assessmentId !== b.assessmentId) {
                    return a.assessmentId.localeCompare(b.assessmentId);
                }
                return (a.attemptNumber || 0) - (b.attemptNumber || 0);
            });
            
            setCompletedAssessments(enrichedResults);
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

  const getAssessmentTitle = (assessment: EnrichedResult) => {
    if (assessment.totalAttempts && assessment.totalAttempts > 1) {
        return `${assessment.assessmentTitle} (${assessment.attemptNumber}차 시도)`;
    }
    return assessment.assessmentTitle;
  }
  
  const getResultLink = (assessment: EnrichedResult) => {
    const baseLink = `/student/assessment/${assessment.assessmentId}/results`;

    if (assessment.totalAttempts && assessment.totalAttempts > 1) {
        return `${baseLink}?attempt=${assessment.attemptNumber}`;
    }
    return baseLink;
  }
  
  const getAssessmentTypeText = (assessmentType?: 'monologue' | 'dialogue') => {
      if (assessmentType === 'dialogue') {
          return t.teacherAssessments.assessmentTypes.dialogue;
      }
      return t.teacherAssessments.assessmentTypes.monologue;
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
                    <TableHead>{t.studentHistory.assessment}</TableHead>
                    <TableHead>평가 유형</TableHead>
                    <TableHead>{t.studentHistory.completionDate}</TableHead>
                    <TableHead>내용 점수</TableHead>
                    <TableHead>발음 점수</TableHead>
                    <TableHead className="text-right">{t.studentHistory.action}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {completedAssessments.length > 0 ? (
                    completedAssessments.map((assessment, index) => {
                        const nextAssessment = completedAssessments[index + 1];
                        const isLastInGroup = !nextAssessment || nextAssessment.assessmentId !== assessment.assessmentId;
                        
                        return (
                            <TableRow 
                                key={assessment.id}
                                className={cn(!isLastInGroup && "border-b-0 border-dashed")}
                            >
                                <TableCell className={cn("font-medium", !isLastInGroup && "pb-2", isLastInGroup && "pt-4")}>{getAssessmentTitle(assessment)}</TableCell>
                                <TableCell className={cn(!isLastInGroup && "pb-2", isLastInGroup && "pt-4")}>
                                    <Badge variant="outline">{getAssessmentTypeText(assessment.assessmentType)}</Badge>
                                </TableCell>
                                <TableCell className={cn(!isLastInGroup && "pb-2", isLastInGroup && "pt-4")}>{assessment.createdAt ? format(new Date(assessment.createdAt), 'yyyy-MM-dd') : 'N/A'}</TableCell>
                                <TableCell className={cn(!isLastInGroup && "pb-2", isLastInGroup && "pt-4")}>
                                    <Badge variant="outline">{assessment.contentScore ?? assessment.score ?? 0}%</Badge>
                                </TableCell>
                                 <TableCell className={cn(!isLastInGroup && "pb-2", isLastInGroup && "pt-4")}>
                                    <Badge variant="outline">{assessment.pronunciationScore ?? 0}%</Badge>
                                </TableCell>
                                <TableCell className={cn("text-right", !isLastInGroup && "pb-2", isLastInGroup && "pt-4")}>
                                    <Link href={getResultLink(assessment)}>
                                        <Button variant="secondary" size="sm">{t.studentHistory.viewFeedback}</Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
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

