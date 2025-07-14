
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { type StudentResult } from '@/lib/types';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MOCK_STUDENT_RESULTS } from '@/lib/mock-data';

export default function HistoryPage() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [completedAssessments, setCompletedAssessments] = useState<StudentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/');
      return;
    }

    // 로컬 목업 데이터 사용
    const results = MOCK_STUDENT_RESULTS.filter(r => r.studentId === user.uid);
    setCompletedAssessments(results);
    setIsLoading(false);

  }, [user, authLoading, router]);

  if (isLoading || authLoading) {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
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
                    <TableHead>{t.studentHistory.completionDate}</TableHead>
                    <TableHead>{t.studentHistory.score}</TableHead>
                    <TableHead className="text-right">{t.studentHistory.action}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {completedAssessments.length > 0 ? (
                    completedAssessments.map((assessment) => (
                        <TableRow key={assessment.id}>
                            <TableCell className="font-medium">{assessment.assessmentTitle}</TableCell>
                            <TableCell>{assessment.date}</TableCell>
                            <TableCell>
                                <Badge variant="outline">{assessment.score}%</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <Link href={`/student/assessment/${assessment.assessmentId}/results`}>
                                    <Button variant="secondary" size="sm">{t.studentHistory.viewFeedback}</Button>
                                </Link>
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
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
