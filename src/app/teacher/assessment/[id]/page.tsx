
"use client";

import { useEffect, useState, useCallback } from "react";
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
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from "@/lib/firebase";
import { format } from "date-fns";


export default function AssessmentSubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;

  const fetchSubmissions = useCallback(async () => {
    if (!user || !assessmentId) return;
    setIsLoading(true);

    try {
        const assessmentRef = doc(db, "assessments", assessmentId);
        const assessmentSnap = await getDoc(assessmentRef);

        if (!assessmentSnap.exists() || assessmentSnap.data().uid !== user.uid) {
            toast({ title: "오류", description: "평가를 찾을 수 없거나 접근 권한이 없습니다.", variant: "destructive"});
            notFound();
            return;
        }
        setAssessment({ id: assessmentSnap.id, ...assessmentSnap.data() } as TeacherAssessment);
        
        // assessmentId가 일치하는 모든 결과를 가져옵니다.
        const resultsQuery = query(
            collection(db, "results"), 
            where("assessmentId", "==", assessmentId),
            orderBy("createdAt", "desc")
        );
        const resultsSnapshot = await getDocs(resultsQuery);
        
        // 필터링 없이 모든 결과를 상태에 저장합니다.
        // 현재 교사가 생성한 평가(assessment)에 대한 결과만 가져오므로 이 방식이 안전합니다.
        const resultsData = resultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentResult));
        
        setStudentResults(resultsData);

    } catch (error) {
        console.error("Error fetching submissions:", error);
        toast({ title: "오류", description: "제출 현황을 불러오는 데 실패했습니다.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [assessmentId, user, toast, notFound]);


  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/');
      } else {
        fetchSubmissions();
      }
    }
  }, [user, authLoading, router, fetchSubmissions]);

  if (isLoading || authLoading) {
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
                  <TableRow key={result.id}>
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
                    <TableCell>{result.contentScore ? `${result.contentScore}%` : "N/A"}</TableCell>
                    <TableCell>{result.createdAt ? format(new Date(result.createdAt), 'yyyy-MM-dd') : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                       <Link href={`/teacher/assessment/${assessmentId}/${result.id}`}>
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
