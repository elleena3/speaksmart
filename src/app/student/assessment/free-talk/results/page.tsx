
"use client";

import { FreeTalkFeedbackView } from "./free-talk-feedback-view"
import { GrowthView } from "../../[id]/results/growth-view";
import { useRouter, notFound, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from "react";
import { type StudentResult, type ResultStatus, type TeacherAssessment, type ConversationTurn } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2, AlertTriangle, CheckCircle2, UploadCloud, AudioLines, FileScan, Sparkles, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, getDocs, getDoc } from "firebase/firestore";
import { generateDialogueAnalysis } from "@/ai/flows/generate-dialogue-analysis-flow";
import { useToast } from "@/hooks/use-toast";

const SESSION_STORAGE_KEY = 'freeTalkSessionData';

type AnalysisStep = "upload" | "analyze" | "report";
type PageStatus = "loading" | "analyzing" | "completed" | "error";

const analysisSteps: { key: AnalysisStep, text: string, icon: React.FC<any> }[] = [
    { key: "upload", text: "대화 내용 업로드", icon: UploadCloud },
    { key: "analyze", text: "내용 및 발음 분석", icon: FileScan },
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

type DialogueSessionData = {
    studentRecordingUrl: string;
    conversationHistory: ConversationTurn[];
    assessment: TeacherAssessment;
};


export default function FreeTalkResultsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [results, setResults] = useState<StudentResult[]>([]);
    const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
    const [status, setStatus] = useState<PageStatus>("loading");
    const [analysisStep, setAnalysisStep] = useState<AnalysisStep | null>(null);
    const [errorInfo, setErrorInfo] = useState<{ message: string, resultId?: string, sessionData?: DialogueSessionData } | null>(null);
    const { toast } = useToast();

    const processDialogueSubmission = useCallback(async (sessionData: DialogueSessionData, existingResultId?: string) => {
        if (!user) return;
        setStatus("analyzing");
        setErrorInfo(null);

        let resultRef;
        if (existingResultId) {
            resultRef = doc(db, "results", existingResultId);
        } else {
            resultRef = doc(collection(db, "results"));
        }

        try {
            const { assessment, studentRecordingUrl, conversationHistory } = sessionData;
            
            setAnalysisStep("upload");
            
            const fullConversationTranscript = conversationHistory
                .map(turn => `${turn.role === 'user' ? '학생' : 'AI'}: ${turn.text}`)
                .join('\n');
            const studentOnlyTranscript = conversationHistory
                .filter(turn => turn.role === 'user')
                .map(turn => turn.text)
                .join(' ');
            
            const initialData: Partial<StudentResult> = {
                studentId: user.uid,
                assessmentId: assessment.id,
                assessmentTitle: assessment.title,
                teacherUid: assessment.uid,
                name: user.displayName || "Student",
                avatarUrl: user.photoURL || '',
                createdAt: Date.now(),
                date: new Date().toISOString(),
                status: "분석 중",
                studentRecordingUrl: studentRecordingUrl,
                studentTranscript: fullConversationTranscript,
            };
            
            await setDoc(resultRef, initialData, { merge: true });

            setAnalysisStep("analyze");
            const analysisResult = await generateDialogueAnalysis({
                studentRecordingUrl: studentRecordingUrl,
                studentTranscript: studentOnlyTranscript,
                fullConversationTranscript: fullConversationTranscript,
                activityPrompt: assessment.prompt,
                expectedFormat: assessment.expectedFormat || "AI와의 자연스러운 대화 능력을 평가합니다.",
                studentName: user.displayName || "Student",
                assessmentTitle: assessment.title.replace(/ - 복사본(\s\d+)?$/, ''),
                evaluationModel: assessment.evaluationModel,
            });

            setAnalysisStep("report");
            const finalResultData: Partial<StudentResult> = {
                ...analysisResult,
                studentTranscript: fullConversationTranscript,
                status: "채점 완료",
            };
            await updateDoc(resultRef, finalResultData);
            
            if (assessment.id !== "free-talk-practice") {
                const assessmentRef = doc(db, "assessments", assessment.id);
                const allResultsQuery = query(collection(db, "results"), where("assessmentId", "==", assessment.id), where("status", "==", "채점 완료"));
                const querySnapshot = await getDocs(allResultsQuery);
                const scores = querySnapshot.docs.map(d => (d.data() as StudentResult).contentScore || 0);
                const newSubmissionCount = querySnapshot.docs.length;
                const newAverage = newSubmissionCount > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / newSubmissionCount) : 0;
                await updateDoc(assessmentRef, { submissionCount: newSubmissionCount, averageScore: newAverage });
            }

        } catch (e: any) {
            console.error("Error generating feedback:", e);
            let errorMessage = "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            if (e.message && e.message.includes("overloaded")) {
                errorMessage = "AI 모델이 과부하 상태입니다. 잠시 후 다시 시도하거나, 교사에게 문의하여 다른 AI 모델로 평가를 변경해달라고 요청할 수 있습니다.";
            } else {
                errorMessage = `AI 분석 중 오류가 발생했습니다: ${e.message}`;
            }
            setErrorInfo({ message: errorMessage, resultId: resultRef.id, sessionData });
            setStatus("error");
            toast({ title: "피드백 생성 오류", description: errorMessage, variant: "destructive" });
            if (resultRef) {
                await updateDoc(resultRef, { status: '오류', aiFeedback: errorMessage });
            }
        } finally {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
    }, [user, toast]);

    const handleRetry = () => {
        if (errorInfo?.sessionData) {
            processDialogueSubmission(errorInfo.sessionData, errorInfo.resultId);
        } else {
            toast({ title: "재시도 정보 없음", description: "재시도할 수 있는 정보가 없습니다.", variant: "destructive"});
        }
    }


    useEffect(() => {
        if(authLoading || !user) return;

        const storedDataString = sessionStorage.getItem(SESSION_STORAGE_KEY);
        const sessionData: DialogueSessionData | null = storedDataString ? JSON.parse(storedDataString) : null;
        const assessmentId = sessionData?.assessment?.id || searchParams.get('assessmentId');

        if (!assessmentId) {
            toast({ title: "평가 정보 없음", description: "대시보드로 돌아갑니다.", variant: "destructive" });
            router.push('/student/dashboard');
            return;
        }

        const q = query(
            collection(db, "results"),
            where("assessmentId", "==", assessmentId),
            where("studentId", "==", user.uid)
        );
        
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const dbResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentResult));
            
            dbResults.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

            const stillProcessing = dbResults.some(r => r.status !== '채점 완료' && r.status !== '오류');
            
            if (dbResults.length > 0) {
                const assessmentRef = doc(db, 'assessments', assessmentId);
                const assessmentSnap = await getDoc(assessmentRef);
                if (assessmentSnap.exists()) {
                    setAssessment({id: assessmentSnap.id, ...assessmentSnap.data()} as TeacherAssessment);
                } else {
                    notFound();
                    return;
                }
                setResults(dbResults);
                
                const latestResult = dbResults[dbResults.length - 1];
                if(latestResult.status === '오류'){
                    setStatus('error');
                    setErrorInfo({ 
                        message: latestResult.aiFeedback, 
                        resultId: latestResult.id,
                        sessionData: {
                            assessment: (await getDoc(doc(db, 'assessments', latestResult.assessmentId))).data() as TeacherAssessment,
                            studentRecordingUrl: latestResult.studentRecordingUrl!,
                            conversationHistory: JSON.parse(latestResult.studentTranscript || '[]'),
                        }
                    });
                } else if (!stillProcessing) {
                  setStatus("completed");
                } else {
                  setStatus("analyzing");
                }
            } else if (sessionData) {
                processDialogueSubmission(sessionData);
            } else {
                setStatus("completed");
            }
        }, (err) => {
            console.error("Error listening to result:", err);
            setErrorInfo({ message: "결과를 실시간으로 업데이트하는 중 오류가 발생했습니다."});
            setStatus("error");
        });

        return () => unsubscribe();
        
    }, [user, authLoading, router, toast, processDialogueSubmission, searchParams]);


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
      const assessmentIdOnError = results[0]?.assessmentId || assessment?.id;
      return (
          <Card className="flex flex-col items-center justify-center text-center p-8 min-h-80 bg-destructive/10 border-destructive">
              <CardHeader>
                  <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <CardTitle className="text-destructive">분석 오류</CardTitle>
                  <CardDescription className="text-destructive-foreground">{errorInfo?.message || "AI가 답변을 분석하는 데 실패했습니다. 다시 시도해주세요."}</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button onClick={handleRetry}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    재분석 시도
                </Button>
                <Button variant="secondary" onClick={() => router.push(`/student/assessment/free-talk?id=${assessmentIdOnError}`)}>
                    대화로 돌아가기
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
               <Button onClick={() => router.push(`/student/assessment/free-talk?id=${assessment.id}`)} className="mt-4">평가 시작하기</Button>
           </div>
        );
      }
      if (results.length === 1) {
        return <FreeTalkFeedbackView result={results[0]} assessment={assessment} isLatestAttempt={true} />;
      }
      if (results.length > 1) {
        return <GrowthView results={results} assessment={assessment} />;
      }
    }

    return null;
}

    