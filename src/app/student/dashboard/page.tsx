
"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { type TeacherAssessment, type StudentResult } from "@/lib/types"
import { CheckCircle2, MessageCircle, Mic, Loader2, AlertCircle, UploadCloud } from "lucide-react"
import { useLanguage } from "@/context/language-context"
import { db, storage } from "@/lib/firebase"
import { collection, query, where, getDocs, orderBy, onSnapshot } from "firebase/firestore"
import { ref, uploadString } from "firebase/storage"
import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"

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
  const { t } = useLanguage();
  const { toast } = useToast();
  const [assessments, setAssessments] = useState<CombinedAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTestingUpload, setIsTestingUpload] = useState(false);

  const handleUploadTest = async () => {
    if (!user) return;
    setIsTestingUpload(true);
    toast({ title: "업로드 테스트 시작...", description: "Firebase Storage에 테스트 파일을 업로드합니다." });

    const testContent = `Hello Storage! This is a test file from user ${user.uid} at ${new Date().toISOString()}`;
    const testFileRef = ref(storage, `test-uploads/test-file-${user.uid}.txt`);

    try {
        await uploadString(testFileRef, testContent);
        toast({
            title: "✅ 업로드 성공!",
            description: "Firebase Storage에서 'test-uploads' 폴더를 확인해주세요."
        });
    } catch (error: any) {
        console.error("Storage Upload Test Failed:", error);
        toast({
            title: "❌ 업로드 실패",
            description: `오류: ${error.message}`,
            variant: "destructive"
        });
    } finally {
        setIsTestingUpload(false);
    }
  };

  useEffect(() => {
    if (authLoading || !user) return;

    const assessmentsQuery = query(collection(db, "assessments"), orderBy("createdAt", "desc"));
    
    // Fetch all assessments once
    getDocs(assessmentsQuery).then(assessmentsSnapshot => {
        const teacherAssessments = assessmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherAssessment));

        // Then, set up a real-time listener for results
        const resultsQuery = query(collection(db, "results"), where("studentId", "==", user.uid));
        const unsubscribe = onSnapshot(resultsQuery, (resultsSnapshot) => {
            const resultsMap = new Map<string, { status: StudentResult['status'], id: string }>();
            resultsSnapshot.forEach(doc => {
                resultsMap.set(doc.data().assessmentId, { status: doc.data().status, id: doc.id });
            });

            const combined = teacherAssessments.map(assessment => {
                const resultInfo = resultsMap.get(assessment.id);
                return {
                    ...assessment,
                    resultStatus: resultInfo ? resultInfo.status : null,
                    resultId: resultInfo ? resultInfo.id : undefined,
                };
            });
            
            setAssessments(combined);
            setIsLoading(false);
        }, (error) => {
            console.error("Failed to listen for results", error);
            setIsLoading(false);
        });

        return () => unsubscribe(); // Cleanup listener on unmount
    }).catch(error => {
        console.error("Failed to load assessments from Firestore", error);
        setIsLoading(false);
    });

  }, [user, authLoading]);
  
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
        {/* 임시 테스트 버튼 */}
        <Button onClick={handleUploadTest} variant="outline" disabled={isTestingUpload}>
            {isTestingUpload ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            스토리지 테스트 업로드
        </Button>
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
