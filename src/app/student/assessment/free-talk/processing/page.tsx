
"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from "react";
import { type StudentResult, type TeacherAssessment, type ConversationTurn, type HistoricalScore } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2, AlertTriangle, CheckCircle2, UploadCloud, FileScan, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db, storage } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, addDoc, orderBy } from "firebase/firestore";
import { generateDialogueAnalysis } from "@/ai/flows/generate-dialogue-analysis-flow";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';

const SESSION_STORAGE_KEY = 'freeTalkSessionData';

type AnalysisStep = "upload" | "analyze" | "report";
type PageStatus = "loading" | "analyzing" | "completed" | "error";

const analysisSteps: { key: AnalysisStep, text: string, icon: React.FC<any> }[] = [
    { key: "upload", text: "대화 파일 업로드", icon: UploadCloud },
    { key: "analyze", text: "대화 내용 및 발음 분석", icon: FileScan },
    { key: "report", text: "피드백 리포트 생성", icon: Sparkles },
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
                <CardDescription>대화 내용을 분석하고 있습니다. 이 과정은 최대 1-2분 소요될 수 있습니다.</CardDescription>
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

type DialogueSessionData = {
    studentRecordingDataUri: string;
    conversationHistory: ConversationTurn[];
    assessment: TeacherAssessment;
};


export default function DialogueProcessingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get('id');
  const { toast } = useToast();
  
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep | null>(null);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [errorInfo, setErrorInfo] = useState<{ message: string } | null>(null);
  
  const isProcessing = useRef(false);
  const resultIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<() => void | undefined>();

  useEffect(() => {
    if (authLoading || !user || !assessmentId) return;

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
        router.replace(`/student/assessment/free-talk?id=${assessmentId}`);
        return;
    }
    
    if (isProcessing.current) return;
    
    const sessionData = JSON.parse(sessionDataRaw) as DialogueSessionData;
    if (sessionData.assessment.id !== assessmentId) {
        console.error("Mismatched assessment ID in session. Clearing.");
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        router.replace(`/student/assessment/free-talk?id=${assessmentId}`);
        return;
    }

    const startAnalysis = async () => {
        isProcessing.current = true;
        setStatus("analyzing");
        setErrorInfo(null);
        console.log("[Dialogue Processing Page] Starting analysis process.");

        const { assessment, studentRecordingDataUri, conversationHistory } = sessionData;
        
        try {
            const newResultDocRef = await addDoc(collection(db, "results"), {
                studentId: user.uid,
                assessmentId: assessment.id,
                assessmentTitle: assessment.title,
                teacherUid: assessment.uid,
                name: user.displayName || "Student",
                avatarUrl: user.photoURL || '',
                createdAt: Date.now(),
                date: new Date().toISOString(),
                status: "분석 중: upload",
            });
            resultIdRef.current = newResultDocRef.id;
            console.log(`[Dialogue Processing] Created preliminary result document: ${newResultDocRef.id}`);

            // Set up snapshot listener for this specific document
            unsubscribeRef.current = onSnapshot(newResultDocRef, (doc) => {
                const resultData = doc.data() as StudentResult;
                if (!resultData) return;

                console.log(`[Dialogue Processing Snapshot] Detected status change: ${resultData.status}`);
                if (resultData.status === '채점 완료') {
                     // 분석 완료 후 추가 작업 수행
                    (async () => {
                        try {
                            const resultsQuery = query(
                                collection(db, "results"),
                                where("assessmentId", "==", assessment.id),
                                where("studentId", "==", user.uid),
                                where("status", "==", "채점 완료"),
                                orderBy("createdAt", "asc")
                            );
                            const querySnapshot = await getDocs(resultsQuery);

                            const allAttempts = querySnapshot.docs.map(doc => doc.data() as StudentResult);
                            
                            // Historical Scores 캐싱
                            const historicalScores: HistoricalScore[] = allAttempts.map((attempt, index) => ({
                                attempt: index + 1,
                                contentScore: attempt.contentScore,
                                pronunciationScore: attempt.pronunciationScore || 0,
                                rubricScores: attempt.rubricScores
                            }));

                            await updateDoc(doc.ref, { historicalScores });

                            // 전체 평가의 평균 점수 및 제출 횟수 업데이트
                            const assessmentRef = doc(db, "assessments", assessment.id);
                            const scores = allAttempts.map(d => d.contentScore || 0);
                            const newSubmissionCount = new Set(allAttempts.map(r => r.studentId)).size;
                            const newAverage = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
                            
                            await updateDoc(assessmentRef, {
                                submissionCount: newSubmissionCount,
                                averageScore: newAverage
                            });
                             console.log(`[Dialogue Processing] Updated assessment stats for ${assessment.id}.`);
                        } catch(e) {
                            console.error("Error updating stats after completion:", e);
                        } finally {
                             setStatus("completed");
                             const attempt = (sessionStorage.getItem('attemptCount') || '1')
                             router.push(`/student/assessment/free-talk/results?id=${assessmentId}&attempt=${attempt}`);
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

            // Upload recording
            const storageRef = ref(storage, `recordings/${user.uid}_dialogue_${newResultDocRef.id}.webm`);
            const uploadSnapshot = await uploadString(storageRef, studentRecordingDataUri, 'data_url');
            const downloadURL = await getDownloadURL(uploadSnapshot.ref);
            await updateDoc(newResultDocRef, { studentRecordingUrl: downloadURL });
            console.log(`[Dialogue Processing] Audio uploaded to ${downloadURL}`);

            // Prepare transcripts
            const fullConversationTranscript = conversationHistory
                .map(turn => `${turn.role === 'user' ? '학생' : (assessment.aiVoice || 'AI')}: ${turn.text}`)
                .join('\n');
            const studentOnlyTranscript = conversationHistory
                .filter(turn => turn.role === 'user')
                .map(turn => turn.text)
                .join(' ');
            
            // Call the main analysis flow, passing teacherUid explicitly
            await generateDialogueAnalysis({
                resultId: newResultDocRef.id,
                teacherUid: assessment.uid,
                studentRecordingUrl: downloadURL,
                studentTranscript: studentOnlyTranscript,
                fullConversationTranscript: fullConversationTranscript,
                activityPrompt: assessment.prompt,
                expectedFormat: assessment.expectedFormat || "AI와의 자연스러운 대화 능력을 평가합니다.",
                studentName: user.displayName || "Student",
                assessmentTitle: assessment.title,
                evaluationModel: assessment.evaluationModel,
                useRubric: assessment.useRubric || false,
            });

            console.log("[Dialogue Processing] AI flow invocation completed.");
            
        } catch (e: any) {
            console.error("[Dialogue Processing] Error during analysis:", e);
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
                    console.error("[Dialogue Processing] Error updating document to error state:", updateError);
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
  }, [assessmentId, user, authLoading, router, toast]);

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
                <Button variant="secondary" onClick={() => router.push(`/student/assessment/free-talk?id=${assessmentId}`)}>
                    대화로 돌아가기
                </Button>
            </CardContent>
        </Card>
    );
  }

  return null;
}
