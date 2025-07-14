
"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { type TeacherAssessment, type StudentResult } from "@/lib/types"
import { CheckCircle2, MessageCircle, Mic, Loader2, AlertCircle, UploadCloud } from "lucide-react"
import { useLanguage } from "@/context/language-context"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";


type CombinedAssessment = TeacherAssessment & {
    resultStatus?: '채점 완료' | '채점 중' | '오류' | null;
    resultId?: string;
};

function AssessmentCard({ assessment, t }: { assessment: CombinedAssessment, t: any }) {
  const isCompleted = assessment.resultStatus === '채점 완료';
  const isGrading = assessment.resultStatus === '채점 중';
  const hasError = assessment.resultStatus === '오류';

  const getStatusText = () => {
    if (hasError) return "오류 발생";
    if (isGrading) return "채점 중...";
    if (isCompleted) return t.studentDashboard.status.graded;
    return t.studentDashboard.status.todo;
  }
  
  const getBadgeVariant = () => {
    if (hasError) return "destructive";
    if (isGrading) return "secondary";
    if (isCompleted) return "default";
    return "outline";
  }

  const getIcon = () => {
    if (hasError) return <AlertCircle className="h-5 w-5" />;
    if (isGrading) return <Loader2 className="h-5 w-5 animate-spin" />;
    if (isCompleted) return <CheckCircle2 className="h-5 w-5" />;
    return assessment.assessmentType === 'dialogue' ? <MessageCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />;
  }
  
  const getButtonText = () => {
      if (hasError) return "결과 보기";
      if (isGrading) return "채점 현황 보기";
      if (isCompleted) return t.studentDashboard.viewResults;
      return t.studentDashboard.startAssessment;
  }

  const getLink = () => {
    if (isCompleted || isGrading || hasError) return `/student/assessment/${assessment.id}/results`;
    if (assessment.assessmentType === 'dialogue') {
      return `/student/assessment/free-talk?id=${assessment.id}`;
    }
    return `/student/assessment/${assessment.id}`;
  }


  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl">{assessment.title}</CardTitle>
          <Badge variant={getBadgeVariant()}>
            {getStatusText()}
          </Badge>
        </div>
        <CardDescription>{assessment.topic}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow" />
      <CardFooter>
        <Link href={getLink()} passHref className="w-full">
          <Button className="w-full">
            {getIcon()}
            <span className="ml-2">{getButtonText()}</span>
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

export default function StudentDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [assessments, setAssessments] = useState<CombinedAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAssessments = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
        const assessmentsQuery = query(collection(db, "assessments"), orderBy("createdAt", "desc"));
        const resultsQuery = query(collection(db, "results"), where("studentId", "==", user.uid));
        
        const [assessmentsSnapshot, resultsSnapshot] = await Promise.all([
            getDocs(assessmentsQuery),
            getDocs(resultsQuery),
        ]);

        const studentResultsMap = new Map<string, { status: StudentResult['status'], id: string }>();
        resultsSnapshot.forEach(doc => {
            const resultData = doc.data() as StudentResult;
            studentResultsMap.set(resultData.assessmentId, { status: resultData.status, id: doc.id });
        });
        
        const combined = assessmentsSnapshot.docs.map(doc => {
            const assessment = { id: doc.id, ...doc.data() } as TeacherAssessment;
            const resultInfo = studentResultsMap.get(assessment.id);
            return {
                ...assessment,
                resultStatus: resultInfo ? resultInfo.status : null,
                resultId: resultInfo ? resultInfo.id : undefined,
            };
        });
        
        setAssessments(combined);
    } catch (error) {
        console.error("Error fetching assessments:", error);
        toast({
            title: "데이터 로딩 오류",
            description: "평가 목록을 불러오는 데 실패했습니다. 나중에 다시 시도해주세요.",
            variant: "destructive",
        });
    } finally {
        setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/');
      } else {
        fetchAssessments();
      }
    }
  }, [user, authLoading, router, fetchAssessments]);
  
  if (isLoading || authLoading) {
      return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight">{t.studentDashboard.welcome}</h2>
            <p className="text-muted-foreground">{t.studentDashboard.description}</p>
        </div>
      </div>


      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {assessments.length > 0 ? assessments.map((assessment) => (
          <AssessmentCard key={assessment.id} assessment={assessment} t={t} />
        )) : (
            <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg">
                <h3 className="text-lg font-medium text-muted-foreground">할당된 평가 없음</h3>
                <p className="text-sm text-muted-foreground mt-1">현재 참여할 수 있는 평가가 없습니다.</p>
            </div>
        )}
      </div>
    </div>
  )
}
