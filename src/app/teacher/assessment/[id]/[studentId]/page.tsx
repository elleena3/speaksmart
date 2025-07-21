
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { type TeacherAssessment, type StudentResult } from "@/lib/types";
import { useAuth, mockStudents } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function AttemptDetailView({ result, assessment, attemptNumber }: { result: StudentResult, assessment: TeacherAssessment, attemptNumber: number }) {
  const {
    aiFeedback,
    studentTranscript,
    studentRecordingUrl,
    pronunciationScore,
    contentScore,
    studentRawFeedback,
    teacherGuidance,
    curricularRemarks
  } = result;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>학생 답변</CardTitle>
          <CardDescription>{attemptNumber}차 시도의 학생 음성 답변과 텍스트 변환 내용입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {studentRecordingUrl && (
            <audio controls src={studentRecordingUrl} className="w-full" />
          )}
          <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-mono text-sm leading-relaxed italic max-h-60 overflow-y-auto">
            "{studentTranscript}"
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI 성능 분석</CardTitle>
          <CardDescription>AI가 분석한 내용 및 발음 점수입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {contentScore !== undefined && (
            <div className="w-full">
              <div className="flex justify-between mb-1">
                <span className="text-base font-medium text-primary">내용 점수</span>
                <span className="text-sm font-medium text-primary">{contentScore}%</span>
              </div>
              <Progress value={contentScore} className="h-2" />
            </div>
          )}
          {pronunciationScore !== undefined && (
            <div className="w-full">
              <div className="flex justify-between mb-1">
                <span className="text-base font-medium text-primary">발음 점수</span>
                <span className="text-sm font-medium text-primary">{pronunciationScore}%</span>
              </div>
              <Progress value={pronunciationScore} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
                <CardTitle>교사용 AI 조언</CardTitle>
            </CardHeader>
            <CardContent className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed min-h-[150px]">
                {teacherGuidance}
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
                <CardTitle>AI 생성 교과과정 비고</CardTitle>
            </CardHeader>
            <CardContent className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed min-h-[150px]">
                {curricularRemarks}
            </CardContent>
          </Card>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>학생에게 제공된 AI 종합 피드백</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg font-body text-base leading-relaxed markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {aiFeedback}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {studentRawFeedback && (
        <Card>
            <CardHeader>
                <CardTitle>학생이 보낸 피드백</CardTitle>
                <CardDescription>이 평가 활동에 대해 학생이 남긴 의견입니다.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed italic">
                "{studentRawFeedback}"
            </CardContent>
        </Card>
      )}
    </div>
  )
}


export default function TeacherStudentResultView() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [student, setStudent] = useState<(typeof mockStudents)[0] | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const studentId = Array.isArray(params.studentId) ? params.studentId[0] : params.studentId;

  const fetchResultData = useCallback(async () => {
    if (!user || !studentId || !assessmentId) return;
    setIsLoading(true);

    try {
      const assessmentRef = doc(db, "assessments", assessmentId);
      const assessmentSnap = await getDoc(assessmentRef);
      
      if (!assessmentSnap.exists() || assessmentSnap.data().uid !== user.uid) {
        toast({ title: "오류", description: "평가를 찾을 수 없거나 접근 권한이 없습니다.", variant: "destructive" });
        notFound();
        return;
      }
      const assessmentData = { id: assessmentSnap.id, ...assessmentSnap.data() } as TeacherAssessment;
      setAssessment(assessmentData);

      const foundStudent = mockStudents.find(s => s.uid === studentId);
      if (foundStudent) {
        setStudent(foundStudent);
      } else {
        toast({ title: "오류", description: "학생 정보를 찾을 수 없습니다.", variant: "destructive" });
        notFound();
        return;
      }
      
      // Firestore Indexing 문제를 피하기 위해 쿼리를 단순화합니다.
      const resultsQuery = query(
        collection(db, "results"),
        where("assessmentId", "==", assessmentId),
        where("studentId", "==", studentId)
      );
      const resultsSnap = await getDocs(resultsQuery);

      if (resultsSnap.empty) {
        toast({ title: "결과 없음", description: "해당 학생의 평가 결과가 없습니다.", variant: "destructive" });
        router.push(`/teacher/assessment/${assessmentId}`);
        return;
      }
      
      const studentResults = resultsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as StudentResult))
        .filter(res => res.status === '채점 완료') // 클라이언트 측에서 필터링
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); // 클라이언트 측에서 정렬
      
      if(studentResults.length === 0) {
        toast({ title: "결과 없음", description: "해당 학생의 완료된 평가 결과가 없습니다.", variant: "destructive" });
        router.push(`/teacher/assessment/${assessmentId}`);
        return;
      }

      setResults(studentResults);

    } catch (error) {
      console.error("Error fetching result data:", error);
      toast({ title: "오류", description: "결과를 불러오는 중 오류가 발생했습니다.", variant: "destructive" });
      notFound();
    } finally {
      setIsLoading(false);
    }
  }, [studentId, assessmentId, user, toast, router, notFound]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/');
      return;
    }
    fetchResultData();
  }, [user, authLoading, router, fetchResultData]);
  

  if (isLoading || authLoading || !assessment || !student) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <Card>
          <CardHeader className="flex-row items-center gap-4 space-y-0">
             <Avatar className="h-16 w-16">
               <AvatarImage src={student.photoURL || ""} alt={student.displayName || "Student"} />
               <AvatarFallback>{student.displayName?.charAt(0) || "S"}</AvatarFallback>
             </Avatar>
             <div>
                 <CardTitle className="text-2xl">{student.displayName}</CardTitle>
                 <CardDescription>'{assessment.title}' 평가 결과</CardDescription>
             </div>
          </CardHeader>
       </Card>

       <Tabs defaultValue={`attempt-${results.length}`} className="w-full">
         <TabsList>
           {results.map((result, index) => (
             <TabsTrigger key={result.id} value={`attempt-${index + 1}`}>{index + 1}차 시도</TabsTrigger>
           ))}
         </TabsList>
         {results.map((result, index) => (
           <TabsContent key={result.id} value={`attempt-${index + 1}`} className="mt-4">
             <AttemptDetailView result={result} assessment={assessment} attemptNumber={index + 1}/>
           </TabsContent>
         ))}
       </Tabs>
    </div>
  );
}
