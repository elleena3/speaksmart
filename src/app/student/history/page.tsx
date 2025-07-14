
"use client"

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useLanguage } from '@/context/language-context';
import { type StudentResult, type TeacherAssessment } from '@/lib/types';

export default function HistoryPage() {
  const { t } = useLanguage();
  const [completedAssessments, setCompletedAssessments] = useState<StudentResult[]>([]);
  const [assessmentTitles, setAssessmentTitles] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    // This code runs only on the client, where localStorage is available.
    const studentResults: StudentResult[] = JSON.parse(localStorage.getItem('student_results') || '[]');
    const teacherAssessments: TeacherAssessment[] = JSON.parse(localStorage.getItem('assessments') || '[]');

    const validAssessmentIds = new Set(teacherAssessments.map(a => a.id));
    const titleMap = teacherAssessments.reduce((acc, assessment) => {
        acc[assessment.id] = assessment.title;
        return acc;
    }, {} as { [key: string]: string });

    const filteredResults = studentResults.filter(result => validAssessmentIds.has(result.assessmentId));
    
    setCompletedAssessments(filteredResults);
    setAssessmentTitles(titleMap);
  }, []);

  const getAssessmentTitle = (assessment: StudentResult) => {
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
