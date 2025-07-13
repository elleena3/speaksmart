
"use client"

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useLanguage } from '@/context/language-context';
import { type StudentResult } from '@/lib/types';

// This is a mapping from assessment ID to a more friendly title if needed.
const assessmentTitles: { [key: string]: string } = {
  "1": "5단원: 나의 일과",
  "2": "6단원: 사람 묘사하기",
  "3": "중간 말하기 시험",
  "4": "7단원: 취미와 관심사",
  // Add other known IDs here if they don't have a title in the result object
};

export default function HistoryPage() {
  const { t } = useLanguage();
  const [completedAssessments, setCompletedAssessments] = useState<StudentResult[]>([]);

  useEffect(() => {
    // This code runs only on the client, where localStorage is available.
    const results: StudentResult[] = JSON.parse(localStorage.getItem('student_results') || '[]');
    setCompletedAssessments(results);
  }, []);

  const getAssessmentTitle = (assessment: StudentResult) => {
    // In a real app, the result object would likely contain the title.
    // Here we fall back to a mapping.
    return assessmentTitles[assessment.assessmentId] || `평가 ID: ${assessment.assessmentId}`;
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
                        <TableRow key={assessment.assessmentId}>
                            <TableCell className="font-medium">{getAssessmentTitle(assessment)}</TableCell>
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
