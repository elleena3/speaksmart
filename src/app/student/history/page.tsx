import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const pastAssessments = [
    { id: "3", title: "중간 말하기 시험", score: 91, date: "2024-05-24" },
    { id: "2", title: "6단원: 사람 묘사하기", score: 78, date: "2024-05-17" },
    { id: "1", title: "5단원: 나의 일과", score: 85, date: "2024-05-10" },
];

export default function HistoryPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>내 결과</CardTitle>
        <CardDescription>완료된 모든 평가 기록입니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>평가</TableHead>
                    <TableHead>완료 날짜</TableHead>
                    <TableHead>점수</TableHead>
                    <TableHead>작업</TableHead>
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
                                <Button variant="secondary" size="sm">피드백 보기</Button>
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
