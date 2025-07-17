
"use client";

import { FeedbackView } from "./feedback-view"
import { GrowthView } from "./growth-view"
import { useParams, useRouter, notFound } from 'next/navigation';
import { useEffect, useState, useCallback } from "react";
import { type StudentResult, type ResultStatus, type TeacherAssessment } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2, AlertTriangle, CheckCircle2, UploadCloud, AudioLines, FileScan, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, getDocs, getDoc } from "firebase/firestore";
import { generateMonologueAnalysis } from "@/ai/flows/generate-monologue-analysis-flow";
import { useToast } from "@/hooks/use-toast";

const SESSION_STORAGE_KEY = 'monologueSessionData';

type AnalysisStep = "upload" | "transcribe" | "analyze" | "report";

const analysisSteps: { key: AnalysisStep, text: string, icon: React.FC<any> }[] = [
    { key: "upload", text: "답변 파일 업로드", icon: UploadCloud },
    { key: "transcribe", text: "음성을 텍스트로 변환", icon: AudioLines },
    { key: "analyze", text: "내용 및 발음 분석", icon: FileScan },
    { key: "report", text: "리포트 생성", icon: Sparkles },
];

function AnalysisProgressView({ currentStep }: { currentStep: AnalysisStep | null }) {
    const getCurrentStepIndex = () => {
        if (!currentStep) return -1;
        return analysisSteps.findIndex(step => step.key === currentStep);
    }
    const currentStepIndex = getCurrentStepIndex();

    return (
        <Card className="w-full max-w-lg">
            <CardHeader>
                <CardTitle>AI 분석 진행 중</CardTitle>
                <CardDescription>답변을 분석하고 있습니다. 이 과정은 최대 1-2분 소요될 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-4">
                    {analysisSteps.map((step, index) => {
                        const isCompleted = index < currentStepIndex;
                        const isCurrent = index === currentStepIndex;
                        
                        return (
                            <li key={step.key} className="flex items-center gap-4">
                                <div className="flex-shrink-0">
                                    {isCompleted ? (
                                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                                    ) : isCurrent ? (
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    ) : (
                                        <step.icon className="h-6 w-6 text-muted-foreground" />
                                    )}
                                </div>
                                <span className={`font-medium ${isCompleted ? 'text-green-600' : isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {step.text}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </CardContent>
        </Card>
    );
}

export default function AssessmentResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [results, setResults] = useState<StudentResult[]>([]);
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep | null>(null);
  const [status, setStatus] = useState<"loading" | "analyzing" | "completed" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const processMonologueSubmission = useCallback(async () => {
    const sessionDataRaw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionDataRaw || !user) return;
    
    setStatus("analyzing");
    const { assessmentId, studentRecordingUrl, assessmentDetails } = JSON.parse(sessionDataRaw) as { assessmentId: string, studentRecordingUrl: string, assessmentDetails: TeacherAssessment };
    
    if (assessmentId !== id) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setStatus("error");
        setError("세션 정보가 현재 평가와 일치하지 않습니다.");
        return;
    }
    
    let newResultRef = doc(collection(db, "results"));
    
    try {
        setAnalysisStep("upload");
        const initialData: Partial<StudentResult> = {
            studentId: user.uid,
            assessmentId: assessmentDetails.id,
            assessmentTitle: assessmentDetails.title,
            teacherUid: assessmentDetails.uid,
            name: user.displayName || "Student",
            avatarUrl: user.photoURL || '',
            createdAt: Date.now(),
            date: new Date().toISOString(),
            status: "텍스트 변환 중",
            studentRecordingUrl: studentRecordingUrl,
        };
        await setDoc(newResultRef, initialData, { merge: true });
        
        setAnalysisStep("transcribe");
        await updateDoc(newResultRef, { status: "텍스트 변환 중" });

        const analysisResult = await generateMonologueAnalysis({
            studentRecordingUrl: studentRecordingUrl,
            activityPrompt: assessmentDetails.prompt,
            expectedFormat: assessmentDetails.expectedFormat || "",
            studentName: user.displayName || "Student",
            assessmentTitle: assessmentDetails.title,
            evaluationModel: assessmentDetails.evaluationModel,
        });

        setAnalysisStep("analyze");
        await updateDoc(newResultRef, { status: "내용 및 발음 분석 중..." });
        
        setAnalysisStep("report");
        await updateDoc(newResultRef, { status: "리포트 생성 중" });

        const finalResultData: Partial<StudentResult> = {
            ...analysisResult,
            status: '채점 완료',
        };
        await updateDoc(newResultRef, finalResultData);
        
        const assessmentRef = doc(db, "assessments", assessmentDetails.id);
        const resultsCollection = collection(db, "results");
        const q = query(resultsCollection, where("assessmentId", "==", assessmentDetails.id), where("status", "==", "채점 완료"));

        const querySnapshot = await getDocs(q);
        const scores = querySnapshot.docs.map(d => (d.data() as StudentResult).contentScore || 0);
        const newSubmissionCount = querySnapshot.docs.length;
        const newAverage = newSubmissionCount > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / newSubmissionCount) : 0;
        
        await updateDoc(assessmentRef, {
            submissionCount: newSubmissionCount,
            averageScore: newAverage
        });
        
    } catch (e: any) {
      console.error("Error generating analysis:", e);
      let errorMessage = "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      if (e.message && e.message.includes("503") && e.message.includes("overloaded")) {
          errorMessage = "AI 모델이 과부하 상태입니다. 잠시 후 다시 시도하거나, 교사에게 문의하여 다른 AI 모델로 평가를 변경해달라고 요청할 수 있습니다.";
      } else {
          errorMessage = `AI 분석 중 오류가 발생했습니다: ${e.message}`;
      }
      setError(errorMessage);
      setStatus("error");
      await updateDoc(newResultRef, { 
          status: '오류', 
          aiFeedback: errorMessage
      });
    } finally {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [id, user, toast]);

  useEffect(() => {
    if (authLoading || !user || !id) return;
    
    const sessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    
    const q = query(
        collection(db, "results"),
        where("assessmentId", "==", id),
        where("studentId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const dbResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentResult));
        
        // ** FIX: Sort on client side to avoid composite index **
        dbResults.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

        const stillProcessing = dbResults.some(r => r.status !== '채점 완료' && r.status !== '오류');
        
        if (dbResults.length > 0) {
            const assessmentRef = doc(db, 'assessments', id);
            const assessmentSnap = await getDoc(assessmentRef);
            if (assessmentSnap.exists()) {
                setAssessment({id: assessmentSnap.id, ...assessmentSnap.data()} as TeacherAssessment);
            } else {
                notFound();
                return;
            }
            setResults(dbResults);
            if (!stillProcessing) {
              setStatus("completed");
            } else {
              setStatus("analyzing");
            }
        } else if (sessionData) {
            processMonologueSubmission();
        } else {
            setStatus("completed");
        }
    }, (err) => {
        console.error("Error listening to result:", err);
        setError("결과를 실시간으로 업데이트하는 중 오류가 발생했습니다.");
        setStatus("error");
    });
    
    return () => unsubscribe();
  }, [id, user, authLoading, router, processMonologueSubmission]);
  
  if (status === "loading" || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 h-96">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (status === "analyzing") {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 h-96">
        <AnalysisProgressView currentStep={analysisStep} />
      </div>
    );
  }

  if (status === 'error') {
    const latestResultIsError = results.length > 0 && results[results.length - 1].status === '오류';
    return (
        <Card className="flex flex-col items-center justify-center text-center p-8 min-h-80 bg-destructive/10 border-destructive">
            <CardHeader>
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <CardTitle className="text-destructive">분석 오류</CardTitle>
                <CardDescription className="text-destructive-foreground">{error || (latestResultIsError ? results[results.length-1].aiFeedback : "AI가 답변을 분석하는 데 실패했습니다. 다시 시도해주세요.")}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={() => router.push(`/student/assessment/${id}`)}>
                    평가로 돌아가기
                </Button>
            </CardContent>
        </Card>
    );
  }

  if (status === 'completed' && assessment) {
    if (results.length === 0) {
      return (
         <div className="text-center p-8">
             <p>이 평가에 대한 제출된 결과가 없습니다. 평가를 먼저 완료해주세요.</p>
             <Button onClick={() => router.push(`/student/assessment/${id}`)} className="mt-4">평가 시작하기</Button>
         </div>
      );
    }
    
    if (results.length === 1) {
      return <FeedbackView result={results[0]} assessment={assessment} isLatestAttempt={true} />;
    }

    if (results.length > 1) {
      return <GrowthView results={results} assessment={assessment} />;
    }
  }

  return null;
}
