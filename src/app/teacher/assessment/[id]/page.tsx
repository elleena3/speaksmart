
"use client";

import { useEffect, useState } from "react";
import { useParams, notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Loader2, User, ArrowRight } from "lucide-react"
import { type TeacherAssessment, type StudentResult } from "@/lib/types";
import { useLanguage } from "@/context/language-context";

const initialAssessments: TeacherAssessment[] = [
  { id: "1", title: "5단원: 나의 일과", studentsCompleted: 18, totalStudents: 20, averageScore: 85, dateCreated: "2024-05-10", assessmentType: "monologue", prompt: "" },
  { id: "2", title: "6단원: 사람 묘사하기", studentsCompleted: 15, totalStudents: 20, averageScore: 78, dateCreated: "2024-05-17", assessmentType: "monologue", prompt: "" },
  { id: "3", title: "중간 말하기 시험", studentsCompleted: 20, totalStudents: 20, averageScore: 91, dateCreated: "2024-05-24", assessmentType: "monologue", prompt: "" },
  { id: "4", title: "7단원: 취미와 관심사", studentsCompleted: 0, totalStudents: 20, averageScore: 0, dateCreated: "2024-05-31", assessmentType: "monologue", prompt: "" },
];

export default function AssessmentSubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (assessmentId) {
      const storedTeacherAssessments: TeacherAssessment[] = JSON.parse(localStorage.getItem('assessments') || '[]');
      
      const allAssessments = [...initialAssessments];
      storedTeacherAssessments.forEach(localItem => {
          const index = allAssessments.findIndex(initialItem => initialItem.id === localItem.id);
          if (index > -1) {
            allAssessments[index] = localItem;
          } else {
            allAssessments.push(localItem);
          }
      });
      
      const foundAssessment = allAssessments.find((a) => a.id === assessmentId);
      
      if (foundAssessment) {
        setAssessment(foundAssessment);
        const allStudentResults: StudentResult[] = JSON.parse(localStorage.getItem('student_results') || '[]');
        const resultsForThisAssessment = allStudentResults.filter(r => r.assessmentId === assessmentId);
        setStudentResults(resultsForThisAssessment);
      } else {
        // If assessment not found, maybe redirect or show a 'not found' message
        // For now, using Next's notFound utility
        notFound();
      }
      setIsLoading(false);
    }
  }, [assessmentId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assessment) {
    return null; // Should be handled by notFound()
  }
  
  const hasSubmissions = studentResults.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{assessment.title} - 제출 현황</CardTitle>
          <CardDescription>이 평가를 완료한 학생들의 목록입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {hasSubmissions ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>학생</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>점수</TableHead>
                  <TableHead>제출일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentResults.map((result) => (
                  <TableRow key={result.studentId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={result.avatarUrl} alt={result.name} data-ai-hint="person portrait" />
                          <AvatarFallback>{result.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{result.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={result.status === "채점 완료" ? "default" : "secondary"}>
                        {result.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{result.score ? `${result.score}%` : "N/A"}</TableCell>
                    <TableCell>{result.date}</TableCell>
                    <TableCell className="text-right">
                       <Link href={`/teacher/assessment/${assessmentId}/${result.studentId}`}>
                         <Button variant="outline" size="sm">
                           결과 보기 <ArrowRight className="ml-2 h-4 w-4" />
                         </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <User className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="text-lg font-medium text-muted-foreground">제출한 학생 없음</h3>
                  <p className="text-sm text-muted-foreground mt-1">아직 이 평가를 완료한 학생이 없습니다.</p>
              </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
