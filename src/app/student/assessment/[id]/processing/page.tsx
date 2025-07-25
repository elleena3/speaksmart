
"use client";

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from "react";
import { type StudentResult, type TeacherAssessment, type HistoricalScore } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2, AlertTriangle, CheckCircle2, UploadCloud, AudioLines, FileScan, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, addDoc, orderBy, runTransaction } from "firebase/firestore";
import { generateMonologueAnalysisFlow } from "@/ai/flows/generate-monologue-analysis-flow";
import { useToast } from '@/hooks/use-toast';

const SESSION_STORAGE_KEY = 'monologueSessionData';

type AnalysisStep = "upload" | "transcribe" | "analyze" | "report";
type PageStatus = "loading" | "analyzing" | "completed" | "error";

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
            <CardContent className="space-y-6 pt-6">
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

type MonologueSessionData = {
    assessmentId: string, 
    studentRecordingDataUri: string, 
    assessmentDetails: TeacherAssessment
};


export default function ProcessingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep | null>(null);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [errorInfo, setErrorInfo] = useState<{ message: string } | null>(null);
  
  const isProcessing = useRef(false);
  const resultIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<() => void | undefined>();

  useEffect(() => {
    if (authLoading || !user || !id) return;

    if (!db) {
        toast({
            title: "설정 오류",
            description: "Firebase 데이터베이스가 설정되지 않았습니다. 분석을 진행할 수 없습니다.",
            variant: "destructive",
        });
        setStatus("error");
        setErrorInfo({ message: "Firebase DB not configured."})
        return;
    }
    
    const sessionDataRaw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionDataRaw) {
        console.warn("No session data found. Redirecting to assessment page.");
        router.replace(`/student/assessment/${id}`);
        return;
    }
    
    if (isProcessing.current) return;
    
    const sessionData = JSON.parse(sessionDataRaw) as MonologueSessionData;
    if (sessionData.assessmentId !== id) {
        console.error("Mismatched assessment ID in session. Clearing.");
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        router.replace(`/student/assessment/${id}`);
        return;
    }

    const startAnalysis = async () => {
        isProcessing.current = true;
        setStatus("analyzing");
        setErrorInfo(null);
        console.log("[Processing Page] Starting analysis process.");

        const { assessmentDetails, studentRecordingDataUri } = sessionData;
        let newResultDocRef: any = null;
        
        try {
            // Firestore에 결과 문서 사전 생성
            newResultDocRef = await addDoc(collection(db, "results"), {
                studentId: user.uid,
                assessmentId: assessmentDetails.id,
                assessmentTitle: assessmentDetails.title,
                teacherUid: assessmentDetails.uid,
                name: user.displayName || "Student",
                avatarUrl: user.photoURL || '',
                createdAt: Date.now(),
                date: new Date().toISOString(),
                status: "분석 중: upload",
            });
            resultIdRef.current = newResultDocRef.id;
            console.log(`[Processing Page] Created preliminary result document: ${newResultDocRef.id}`);

            // 상태 변경 감지 리스너 설정
            unsubscribeRef.current = onSnapshot(newResultDocRef, (doc) => {
                const resultData = doc.data() as StudentResult;
                if (!resultData) return;

                console.log(`[Processing Page Snapshot] Detected status change: ${resultData.status}`);
                if (resultData.status === '채점 완료') {
                    // 분석 완료 후 추가 작업 수행
                    (async () => {
                        try {
                            // Firestore 트랜잭션을 사용하여 평가 문서 업데이트
                            const assessmentRef = doc(db, "assessments", assessmentDetails.id);
                            await runTransaction(db, async (transaction) => {
                                const assessmentDoc = await transaction.get(assessmentRef);
                                if (!assessmentDoc.exists()) {
                                    throw "Assessment document does not exist!";
                                }

                                const resultsQuery = query(
                                    collection(db, "results"),
                                    where("assessmentId", "==", assessmentDetails.id),
                                    where("status", "==", "채점 완료")
                                );
                                const querySnapshot = await getDocs(resultsQuery);

                                const allAttempts = querySnapshot.docs.map(doc => doc.data() as StudentResult);
                                const scores = allAttempts.map(d => d.contentScore || 0);
                                const studentIds = new Set(allAttempts.map(r => r.studentId));

                                transaction.update(assessmentRef, {
                                    submissionCount: studentIds.size,
                                    averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
                                    [`submissions.${user.uid}`]: 'completed'
                                });

                                console.log(`[Processing Page] Transactionally updated assessment stats for ${assessmentDetails.id}.`);
                            });
                             
                        } catch(e) {
                            console.error("Error updating stats after completion:", e);
                        } finally {
                             setStatus("completed");
                             const attempt = (sessionStorage.getItem('attemptCount') || '1')
                             router.push(`/student/assessment/${id}/results?attempt=${attempt}`);
                        }
                    })();
                } else if (resultData.status === '오류') {
                    setStatus('error');
                    setErrorInfo({ message: resultData.aiFeedback || '알 수 없는 오류가 발생했습니다.' });
                } else if (resultData.status.startsWith('분석 중')) {
                     const stepKey = resultData.status.split(':')[1]?.trim() as AnalysisStep;
                     setAnalysisStep(stepKey || 'upload');
                     setStatus('analyzing');
                }
            });

            // 주 분석 흐름 호출
            await generateMonologueAnalysisFlow({
                resultId: newResultDocRef.id,
                studentRecordingDataUri: studentRecordingDataUri,
                activityPrompt: assessmentDetails.prompt,
                expectedFormat: assessmentDetails.expectedFormat || "",
                studentName: user.displayName || "Student",
                assessmentTitle: assessmentDetails.title,
                evaluationModel: assessmentDetails.evaluationModel,
                useRubric: assessmentDetails.useRubric || false,
                teacherUid: assessmentDetails.uid,
            });

            console.log("[Processing Page] AI flow completed successfully.");

        } catch (e: any) {
            console.error("[Processing Page] Error during analysis flow:", e);
            let errorMessage = "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            if (e.message && (e.message.includes("overloaded") || e.message.includes("503"))) {
                errorMessage = "AI 모델이 과부하 상태입니다. 잠시 후 다시 시도하거나, 교사에게 문의하여 다른 AI 모델로 평가를 변경해달라고 요청할 수 있습니다.";
            } else {
                errorMessage = `AI 분석 중 오류가 발생했습니다: ${e.message}`;
            }
            setErrorInfo({ message: errorMessage });
            setStatus("error");
            if (resultIdRef.current) {
                try {
                    await updateDoc(doc(db, "results", resultIdRef.current), { 
                        status: '오류', 
                        aiFeedback: errorMessage
                    });
                } catch (updateError) {
                    console.error("[Processing Page] Error updating document to error state:", updateError);
                }
            }
        } finally {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            isProcessing.current = false;
        }
    };

    startAnalysis();

    return () => {
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
        }
    };
  }, [id, user, authLoading, router, toast]);

  if (status === "loading" || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 h-96">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">분석 준비 중...</p>
      </div>
    );
  }
  
  if (status === "analyzing") {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 min-h-[30rem]">
        <AnalysisProgressView currentStep={analysisStep} />
      </div>
    );
  }

  if (status === 'error') {
    return (
        <Card className="flex flex-col items-center justify-center text-center p-8 min-h-80 bg-destructive/10 border-destructive">
            <CardHeader>
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <CardTitle className="text-destructive">분석 오류</CardTitle>
                <CardDescription className="text-destructive-foreground">{errorInfo?.message || "AI가 답변을 분석하는 데 실패했습니다. 다시 시도해주세요."}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="secondary" onClick={() => router.push(`/student/assessment/${id}`)}>
                    평가로 돌아가기
                </Button>
            </CardContent>
        </Card>
    );
  }

  return null;
}
