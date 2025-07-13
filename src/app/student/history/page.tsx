import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const pastAssessments = [
    { id: "3", title: "Mid-term Speaking Test", score: 91, date: "2024-05-24" },
    { id: "2", title: "Unit 6: Describing People", score: 78, date: "2024-05-17" },
    { id: "1", title: "Unit 5: My Daily Routine", score: 85, date: "2024-05-10" },
];

export default function HistoryPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Results</CardTitle>
        <CardDescription>A history of all your completed assessments.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Assessment</TableHead>
                    <TableHead>Date Completed</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Action</TableHead>
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
                                <Button variant="secondary" size="sm">View Feedback</Button>
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
