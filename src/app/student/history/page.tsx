
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useLanguage } from '@/context/language-context';

const pastAssessments = [
    { id: "3", title: "중간 말하기 시험", score: 91, date: "2024-05-24" },
    { id: "2", title: "6단원: 사람 묘사하기", score: 78, date: "2024-05-17" },
    { id: "1", title: "5단원: 나의 일과", score: 85, date: "2024-05-10" },
];

export default function HistoryPage() {
  const { t } = useLanguage();
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
                    <TableHead>{t.studentHistory.action}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {pastAssessments.map((assessment) => (
                    <TableRow key={assessment.id}>
                        <TableCell className="font-medium">{assessment.title}</TableCell>
                        <TableCell>{assessment.date}</TableCell>
                        <TableCell>
                            <Badge variant="outline">{assessment.score}%</Badge>
                        </TableCell>
                        <TableCell>
                            <Link href={`/student/assessment/${assessment.id}/results`}>
                                <Button variant="secondary" size="sm">{t.studentHistory.viewFeedback}</Button>
                            </Link>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
