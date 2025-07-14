
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { type StudentResult } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getLanguage } from '@/lib/get-language';

async function getHistory(studentId: string): Promise<StudentResult[]> {
    try {
        const q = query(
            collection(db, "results"), 
            where("studentId", "==", studentId),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentResult));
        return results;
    } catch (error) {
        console.error("Error fetching student history: ", error);
        return [];
    }
}

export default async function HistoryPage() {
  const t = getLanguage();
  // We'll use a mock user ID since login is disabled
  const mockStudentId = "test-user-id";
  const completedAssessments = await getHistory(mockStudentId);

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
