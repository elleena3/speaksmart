

"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { type TeacherAssessment, type StudentResult, type UserData } from "@/lib/types"
import { CheckCircle2, MessageCircle, Mic, Loader2, AlertCircle, TrendingUp, DraftingCompass } from "lucide-react"
import { useLanguage } from "@/context/language-context"
import { useAuth, mockStudents } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, orderBy, doc, getDoc, collectionGroup } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils"


type CombinedAssessment = TeacherAssessment & {
    resultStatus?: '채점 완료' | '채점 중' | '오류' | '분석 중' | '분석 중: upload' | '분석 중: transcribe' | '분석 중: analyze' | '분석 중: report' | null;
    resultId?: string;
    completedAttemptsCount: number;
};

function AssessmentCard({ assessment, t }: { assessment: CombinedAssessment, t: any }) {
  const isCompleted = assessment.completedAttemptsCount > 0;
  const hasMultipleAttempts = assessment.completedAttemptsCount > 1;

  // Determine the display status based on completed attempts first
  let displayStatus: '채점 완료' | '채점 중' | '오류' | '할 일';
  let displayBadgeVariant: "default" | "secondary" | "destructive" | "outline";
  
  if (isCompleted) {
    displayStatus = "채점 완료";
    displayBadgeVariant = "default";
  } else {
    // If not completed, show the status of the latest attempt (which could be '채점 중' or '오류')
    switch(assessment.resultStatus) {
      case '채점 중':
      case '분석 중':
      case '분석 중: upload':
      case '분석 중: transcribe':
      case '분석 중: analyze':
      case '분석 중: report':
        displayStatus = '채점 중';
        displayBadgeVariant = "secondary";
        break;
      case '오류':
        displayStatus = '오류';
        displayBadgeVariant = "destructive";
        break;
      default:
        displayStatus = '할 일';
        displayBadgeVariant = "outline";
    }
  }


  const getIcon = () => {
    if (displayStatus === "오류") return <AlertCircle className="h-5 w-5" />;
    if (displayStatus === "채점 중") return <Loader2 className="h-5 w-5 animate-spin" />;
    if (displayStatus === "채점 완료") {
        return hasMultipleAttempts ? <TrendingUp className="h-5 w-5"/> : <CheckCircle2 className="h-5 w-5" />;
    }
    return assessment.assessmentType === 'dialogue' ? <MessageCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />;
  }
  
  const getButtonText = () => {
      if (displayStatus === "오류") return "다시 시도";
      if (displayStatus === "채점 중") return "채점 현황 보기";
      if (displayStatus === "채점 완료") {
          return hasMultipleAttempts ? "종합 결과 보기" : t.studentDashboard.viewResults;
      }
      return t.studentDashboard.startAssessment;
  }

  const getLink = () => {
    const attemptQuery = hasMultipleAttempts ? `?attempt=${assessment.completedAttemptsCount}` : '';
    
    // For Dialogue
    if (assessment.assessmentType === 'dialogue') {
      if (displayStatus === '채점 완료') return `/student/assessment/free-talk/results?id=${assessment.id}${attemptQuery}`;
      if (displayStatus === '채점 중' && assessment.resultId) return `/student/assessment/free-talk/processing?id=${assessment.id}&resultId=${assessment.resultId}`;
      return `/student/assessment/free-talk?id=${assessment.id}`;
    }

    // For Monologue
    if (displayStatus === '채점 완료') return `/student/assessment/${assessment.id}/results${attemptQuery}`;
    if (displayStatus === '채점 중' && assessment.resultId) return `/student/assessment/${assessment.id}/processing`;
    return `/student/assessment/${assessment.id}`;
  }


  return (
    <Card className={cn(
        "flex flex-col hover:shadow-md transition-shadow",
        isCompleted && "border-slate-200 opacity-80"
      )}>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div className="flex-grow">
                <CardTitle className="text-xl break-keep mb-1">{assessment.title}</CardTitle>
                <div className="flex items-center gap-2">
                    {assessment.useRubric && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <DraftingCompass className="h-3 w-3" />
                        루브릭 평가
                      </Badge>
                    )}
                </div>
            </div>
            <Badge variant={displayBadgeVariant} className="whitespace-nowrap ml-2">
                {displayStatus}
            </Badge>
        </div>
        <CardDescription className="pt-2">{assessment.topic}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow" />
      <CardFooter>
        <Link href={getLink()} passHref className="w-full">
          <Button className="w-full" variant={isCompleted ? 'secondary' : 'default'}>
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

    if (!db) {
        toast({
            title: "설정 오류",
            description: "Firebase 데이터베이스가 설정되지 않았습니다. 평가 목록을 볼 수 없습니다.",
            variant: "destructive",
        });
        setIsLoading(false);
        return;
    }

    try {
        const assessmentsRef = collection(db, "assessments");

        // 1. Fetch assessments assigned to the specific student OR to all students
        const qAssigned = query(assessmentsRef, where("targetStudentIds", "array-contains", user.docId || user.uid));
        const qAll = query(assessmentsRef, where("targetStudentIds", "==", "all"));
        
        const [assignedSnapshot, allSnapshot] = await Promise.all([getDocs(qAssigned), getDocs(qAll)]);
        
        const allAssignedAssessments: TeacherAssessment[] = [];
        const assessmentIds = new Set<string>();

        const processSnapshot = (snapshot: typeof assignedSnapshot) => {
            snapshot.forEach(doc => {
                if (!assessmentIds.has(doc.id)) {
                    assessmentIds.add(doc.id);
                    allAssignedAssessments.push({ id: doc.id, ...doc.data() } as TeacherAssessment);
                }
            });
        };
        processSnapshot(assignedSnapshot);
        processSnapshot(allSnapshot);

        // 2. Fetch all results for this student to determine their status for each assessment
        const resultsQuery = query(collection(db, "results"), where("studentId", "==", user.docId || user.uid));
        const resultsSnapshot = await getDocs(resultsQuery);

        const resultsByAssessment = new Map<string, StudentResult[]>();
        resultsSnapshot.forEach(doc => {
            const result = { id: doc.id, ...doc.data() } as StudentResult;
            const existing = resultsByAssessment.get(result.assessmentId) || [];
            resultsByAssessment.set(result.assessmentId, [...existing, result]);
        });
        
        // 3. Combine assessment data with student's result status
        const combinedAssessments = allAssignedAssessments.map(assessment => {
            const studentResults = resultsByAssessment.get(assessment.id) || [];
            studentResults.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // newest first
            const latestResult = studentResults[0];
            const completedAttemptsCount = studentResults.filter(r => r.status === '채점 완료').length;

            return {
                ...assessment,
                resultStatus: latestResult ? latestResult.status : null,
                resultId: latestResult ? latestResult.id : undefined,
                completedAttemptsCount,
            };
        });

        // 4. Sort the final list: to-do first, then completed, then by creation date
        combinedAssessments.sort((a, b) => {
            const aIsCompleted = a.completedAttemptsCount > 0;
            const bIsCompleted = b.completedAttemptsCount > 0;
            if (aIsCompleted !== bIsCompleted) return aIsCompleted ? 1 : -1;
            return (b.createdAt || 0) - (a.createdAt || 0); // newest first
        });
        
        setAssessments(combinedAssessments);
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
                <h3 className="text-lg font-medium text-muted-foreground">{t.studentDashboard.noAssessments.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.studentDashboard.noAssessments.description}</p>
            </div>
        )}
      </div>
    </div>
  )
}
