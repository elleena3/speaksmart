

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Loader2, User, ArrowRight, CheckCircle, XCircle, RefreshCcw, Trash2, Bot } from "lucide-react"
import { type TeacherAssessment, type StudentResult, type UserData } from "@/lib/types";
import { useAuth, mockStudents } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { retryAnalysis } from "@/ai/flows/retry-analysis-flow";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { rerunAllAnalyses } from "@/ai/flows/rerun-all-analyses-flow";


type EnrichedStudent = UserData & {
    result?: StudentResult;
};

export default function AssessmentSubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [completedStudents, setCompletedStudents] = useState<EnrichedStudent[]>([]);
  const [pendingStudents, setPendingStudents] = useState<EnrichedStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryingIds, setRetryingIds] = useState<string[]>([]);
  const [isRerunningAll, setIsRerunningAll] = useState(false);
  const { toast } = useToast();

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;

  const fetchSubmissions = useCallback(async () => {
    if (!user || !assessmentId) return;
    setIsLoading(true);
    
    if (!db) {
        toast({ title: "오류", description: "Firebase가 설정되지 않았습니다.", variant: "destructive"});
        setIsLoading(false);
        return;
    }

    try {
        const assessmentRef = doc(db, "assessments", assessmentId);
        const assessmentSnap = await getDoc(assessmentRef);

        if (!assessmentSnap.exists() || assessmentSnap.data().uid !== user.uid) {
            toast({ title: "오류", description: "평가를 찾을 수 없거나 접근 권한이 없습니다.", variant: "destructive"});
            notFound();
            return;
        }
        const assessmentData = { id: assessmentSnap.id, ...assessmentSnap.data() } as TeacherAssessment;
        setAssessment(assessmentData);
        
        const resultsQuery = query(
            collection(db, "results"),
            where("assessmentId", "==", assessmentId)
        );
        const resultsSnapshot = await getDocs(resultsQuery);
        
        const resultsMap = new Map<string, StudentResult>();
        resultsSnapshot.forEach(doc => {
            const result = { id: doc.id, ...doc.data() } as StudentResult;
            
            const studentKey = result.studentId;
            const existingResult = resultsMap.get(studentKey);
            // Always store the newest result for each student
            if (!existingResult || (result.createdAt || 0) > (existingResult.createdAt || 0)) {
                resultsMap.set(studentKey, result);
            }
        });
        
        let targetStudents: UserData[] = [];
        if (assessmentData.targetStudentIds === 'all') {
            const allStudentsQuery = query(collection(db, "users"), where("role", "==", "student"));
            const studentsSnapshot = await getDocs(allStudentsQuery);
            const realStudents = studentsSnapshot.docs.map(d => ({...d.data(), docId: d.id, uid: d.id} as UserData));
            targetStudents = [...mockStudents, ...realStudents];
        } else {
            const studentIds = assessmentData.targetStudentIds;
            const realStudentIds = studentIds.filter(id => !id.includes('mock'));
            const mockStudentIds = studentIds.filter(id => id.includes('mock'));
            
            let fetchedRealStudents: UserData[] = [];
            if (realStudentIds.length > 0) {
                 const studentPromises = realStudentIds.map(id => getDoc(doc(db, "users", id)));
                 const studentDocs = await Promise.all(studentPromises);
                 fetchedRealStudents = studentDocs
                    .filter(doc => doc.exists())
                    .map(doc => ({...doc.data(), docId: doc.id, uid: doc.id} as UserData));
            }
           
            const fetchedMockStudents = mockStudents.filter(mock => mockStudentIds.includes(mock.uid));
            
            targetStudents = [...fetchedMockStudents, ...fetchedRealStudents];
        }
        
        const completed: EnrichedStudent[] = [];
        const pending: EnrichedStudent[] = [];

        for (const student of targetStudents) {
            const studentKey = student.docId || student.uid;
            const result = resultsMap.get(studentKey);
            if (result) {
                completed.push({ ...student, result });
            } else {
                pending.push(student);
            }
        }
        
        completed.sort((a, b) => (b.result?.createdAt || 0) - (a.result?.createdAt || 0));
        pending.sort((a,b) => (a.displayName).localeCompare(b.displayName));

        setCompletedStudents(completed);
        setPendingStudents(pending);

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

  const handleRerunAll = async () => {
    if (!assessmentId) return;
    setIsRerunningAll(true);
    toast({ title: "일괄 재평가 시작", description: "모든 제출물을 현재 기준으로 다시 채점합니다. 잠시만 기다려주세요..."});

    try {
        const result = await rerunAllAnalyses({ assessmentId });
        toast({ title: "재평가 완료", description: result.message });
        setTimeout(fetchSubmissions, 3000); // Give time for Firestore to update before refetching
    } catch(error) {
        console.error("Error re-running all analyses:", error);
        toast({ title: "재평가 실패", description: (error as Error).message, variant: "destructive" });
    } finally {
        setIsRerunningAll(false);
    }
  }

  const handleRetry = async (resultId: string) => {
    setRetryingIds(prev => [...prev, resultId]);
    toast({ title: "분석 재시도", description: "AI 분석을 다시 요청하고 있습니다..."});
    try {
        const response = await retryAnalysis({ resultId });
        if (response.success) {
            toast({ title: "성공", description: "분석 재시도를 시작했습니다. 잠시 후 결과가 업데이트됩니다." });
            setTimeout(fetchSubmissions, 5000); // Refresh after 5s
        } else {
            throw new Error(response.message);
        }
    } catch(error) {
         console.error("Error retrying analysis:", error);
         toast({ title: "재시도 실패", description: (error as Error).message, variant: "destructive" });
    } finally {
        setRetryingIds(prev => prev.filter(id => id !== resultId));
    }
  }

  const handleDeleteResult = async (resultId: string) => {
      const studentToRemove = completedStudents.find(s => s.result?.id === resultId);
      try {
        await deleteDoc(doc(db, "results", resultId));
        toast({ 
            title: "삭제 완료", 
            description: `'${studentToRemove?.displayName}' 학생의 결과가 데이터베이스에서 영구적으로 삭제되었습니다.`
        });
        
        if (studentToRemove) {
            setCompletedStudents(prev => prev.filter(s => s.result?.id !== resultId));
            const { result, ...studentData } = studentToRemove;
            setPendingStudents(prev => [...prev, studentData].sort((a,b) => (a.displayName).localeCompare(b.displayName)));
        }
      } catch (error) {
         console.error("Error deleting result:", error);
         toast({ title: "삭제 실패", description: "기록을 삭제하는 중 오류가 발생했습니다.", variant: "destructive" });
      }
  }

  const renderActionButtons = (student: EnrichedStudent) => {
    const { result } = student;
    if (!result) return null;

    const isRetrying = retryingIds.includes(result.id);
    const studentId = student.docId || student.uid;

    if (result.status === "채점 완료") {
        return (
            <Link href={`/teacher/assessment/${assessmentId}/${studentId}`}>
                <Button variant="outline" size="sm">
                    결과 보기 <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </Link>
        );
    }
    
    if (result.status === "오류") {
        if (result.studentRecordingUrl) {
             return (
                <Button variant="outline" size="sm" onClick={() => handleRetry(result.id)} disabled={isRetrying}>
                   {isRetrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCcw className="mr-2 h-4 w-4" />}
                   분석 재시도
                </Button>
           );
        }
    }

    // For "오류" without recording URL, or any other status like "채점 중"
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4"/> 삭제
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>기록을 삭제하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription>
                        현재 상태: <Badge variant="secondary">{result.status}</Badge><br/>
                        이 기록을 삭제하면 학생이 이 평가에 다시 응시할 수 있게 됩니다. 이 작업은 되돌릴 수 없습니다.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteResult(result.id)} className="bg-destructive hover:bg-destructive/90">삭제</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
  };


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

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{assessment.title} - 제출 현황</CardTitle>
              <CardDescription>이 평가에 할당된 모든 학생들의 제출 상태입니다.</CardDescription>
            </div>
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={isRerunningAll || completedStudents.length === 0}>
                        {isRerunningAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Bot className="mr-2 h-4 w-4"/>}
                        모든 제출물 재평가
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>모든 제출물을 재평가하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                            이 작업은 완료된 모든 학생({completedStudents.length}명)의 평가 결과를 **현재 평가의 최신 채점 기준**으로 다시 채점합니다.<br/><br/>
                            <span className="font-bold text-destructive">기존의 모든 점수와 피드백은 새로운 결과로 덮어씌워지며, 이 작업은 되돌릴 수 없습니다.</span><br/><br/>
                            평가 기준(루브릭, 채점 기준 등)을 수정한 후 사용해주세요.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRerunAll}>재평가 시작</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckCircle className="text-green-500" /> 제출한 학생 ({completedStudents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {completedStudents.length > 0 ? (
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
                {completedStudents.map((student) => (
                    <TableRow key={student.docId || student.uid}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={student.photoURL} alt={student.displayName} data-ai-hint="person portrait" />
                          <AvatarFallback>{student.displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{student.displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.result?.status === "채점 완료" ? "default" : student.result?.status === "오류" ? "destructive" : "secondary"}>
                        {student.result?.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{student.result?.contentScore ? `${student.result.contentScore}%` : "N/A"}</TableCell>
                    <TableCell>{student.result?.createdAt ? format(new Date(student.result.createdAt), 'yyyy-MM-dd') : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                       {renderActionButtons(student)}
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
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><XCircle className="text-red-500" /> 미제출 학생 ({pendingStudents.length})</CardTitle>
        </CardHeader>
        <CardContent>
           {pendingStudents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>학생</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead className="text-right">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingStudents.map((student) => (
                  <TableRow key={student.docId || student.uid}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={student.photoURL} alt={student.displayName} data-ai-hint="person portrait" />
                          <AvatarFallback>{student.displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{student.displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{student.email}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">미응시</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <h3 className="text-lg font-medium text-muted-foreground">모든 학생이 평가를 완료했습니다.</h3>
              </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


