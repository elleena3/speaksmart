
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Paperclip, Download, Loader2, Info } from "lucide-react"
import { type TeacherAssessment } from "@/lib/types";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";

// Mock data, assuming no students have completed any assessment yet.
// In a real app, this would be fetched dynamically.
const studentResults: any[] = [];

const curricularRemarks = "학생들은 일상생활 어휘에 대한 높은 이해도를 보였음. 많은 학생들이 현재 시제를 정확하게 사용하는 데 뛰어난 모습을 보임. 공통적인 개선 영역에는 'th' 발음과 다양한 빈도 부사 사용이 포함됨. 전반적으로, 대부분의 학생들이 이 단원에 대한 기대치를 충족하거나 초과하는 등 매우 우수한 성과를 보였음."

export default function AssessmentResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (assessmentId) {
      const storedAssessments = JSON.parse(localStorage.getItem('assessments') || '[]');
      const foundAssessment = storedAssessments.find((a: TeacherAssessment) => a.id === assessmentId);
      
      if (foundAssessment) {
        setAssessment(foundAssessment);
      } else {
        // Fallback for initial mock data that isn't in localStorage
        const initialAssessments: TeacherAssessment[] = [
          { id: "1", title: "5단원: 나의 일과", studentsCompleted: 18, totalStudents: 20, averageScore: 85, dateCreated: "2024-05-10", assessmentType: "monologue", prompt: "" },
          { id: "2", title: "6단원: 사람 묘사하기", studentsCompleted: 15, totalStudents: 20, averageScore: 78, dateCreated: "2024-05-17", assessmentType: "monologue", prompt: "" },
          { id: "3", title: "중간 말하기 시험", studentsCompleted: 20, totalStudents: 20, averageScore: 91, dateCreated: "2024-05-24", assessmentType: "monologue", prompt: "" },
          { id: "4", title: "7단원: 취미와 관심사", studentsCompleted: 0, totalStudents: 20, averageScore: 0, dateCreated: "2024-05-31", assessmentType: "monologue", prompt: "" },
        ];
        const foundInitial = initialAssessments.find(a => a.id === assessmentId);
        if (foundInitial) {
           setAssessment(foundInitial);
        } else {
            toast({
              title: "오류",
              description: "평가 정보를 찾을 수 없습니다.",
              variant: "destructive",
            });
            router.push("/teacher/assessments");
        }
      }
      setIsLoading(false);
    }
  }, [assessmentId, router, toast]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assessment) {
    return null; // Should be redirected by useEffect
  }
  
  const hasSubmissions = studentResults.length > 0;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{assessment.title} - 결과</CardTitle>
            <CardDescription>평가 ID 결과 보기: {assessment.id}</CardDescription>
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
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentResults.map((result) => (
                    <TableRow key={result.studentId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={`https://placehold.co/40x40.png?text=${result.name.charAt(0)}`} alt={result.name} data-ai-hint="person portrait" />
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
                      <TableCell>{result.score ? `${result.score}%` : "해당 없음"}</TableCell>
                      <TableCell>{result.date}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">보기</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Info className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="text-lg font-medium text-muted-foreground">제출된 결과 없음</h3>
                    <p className="text-sm text-muted-foreground mt-1">아직 이 평가를 완료한 학생이 없습니다.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>교과과정 비고 초안</CardTitle>
            <CardDescription>수업 성과에 기반한 AI 생성 초안입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea readOnly value={hasSubmissions ? curricularRemarks : "학생 결과가 제출되면 AI가 비고 초안을 생성합니다."} className="h-48 bg-muted/50" disabled={!hasSubmissions} />
            <Button className="w-full mt-4" disabled={!hasSubmissions}>
              <Paperclip className="mr-2 h-4 w-4" /> 기록에 저장
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>학생 피드백 요약</CardTitle>
             <CardDescription>이 평가에 대한 학생들의 AI 요약 피드백입니다.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg italic">
                {hasSubmissions ? 
                    "지시문은 명확했지만, 일부 학생들은 시간제한이 약간 부담스럽다고 느꼈습니다. 몇몇 학생들은 실제 평가 전에 연습 모드를 추가할 것을 제안했습니다."
                    : "학생 피드백이 제출되면 AI가 요약을 생성합니다."
                }
             </div>
            <Button variant="outline" className="w-full mt-4" disabled={!hasSubmissions}>
              <Download className="mr-2 h-4 w-4" /> 전체 피드백 다운로드
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
