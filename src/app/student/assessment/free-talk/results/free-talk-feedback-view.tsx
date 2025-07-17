
"use client"

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, UploadCloud, AudioLines, FileScan, Sparkles, CheckCircle2 } from "lucide-react";
import { generateDialogueAnalysis } from "@/ai/flows/generate-dialogue-analysis-flow";
import { type StudentResult, type TeacherAssessment, type ConversationTurn, type ResultStatus } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { FeedbackView } from "../../../assessment/[id]/results/feedback-view";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, doc, query, where, getDocs, setDoc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { Card, CardHeader, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

const SESSION_STORAGE_KEY = 'freeTalkSessionData';

type StoredSessionData = {
    studentRecordingUrl: string;
    conversationHistory: ConversationTurn[];
    assessment: TeacherAssessment;
}

type AnalysisStep = "upload" | "analyze" | "report";
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

export function FreeTalkFeedbackView() {
    const { user, loading: authLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [result, setResult] = useState<StudentResult | null>(null);
    const [status, setStatus] = useState<ResultStatus>("분석 중");
    const [analysisStep, setAnalysisStep] = useState<AnalysisStep | null>(null);
    const [error, setError] = useState<string | null>(null);

    const router = useRouter();
    const { toast } = useToast();

    const generateFeedback = useCallback(async (sessionData: StoredSessionData) => {
        if (!user) return;
        setIsLoading(true);
        let newResultRef: any; 

        try {
            const { assessment, studentRecordingUrl, conversationHistory } = sessionData;
            
            // For practice sessions, we don't save to DB.
            if (assessment.id === 'free-talk-practice') {
                toast({ title: "연습 모드에서는 결과가 저장되지 않습니다." });
                // We could show a temporary result here if needed, then route away.
                // For now, let's just route to dashboard.
                router.push('/student/dashboard');
                return;
            }
            
            setAnalysisStep("upload"); // Logical step
            
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
                studentTranscript: fullConversationTranscript, // Save full transcript initially
            };
            
            // Check for existing result and create/update accordingly
            const resultsQuery = query(collection(db, "results"), where("assessmentId", "==", assessment.id), where("studentId", "==", user.uid));
            const existingDocs = await getDocs(resultsQuery);

            const batch = writeBatch(db);
            if (!existingDocs.empty) {
                // Delete old results for this assessment by this student
                existingDocs.forEach(doc => batch.delete(doc.ref));
            }
            newResultRef = doc(collection(db, "results"));
            batch.set(newResultRef, initialData);
            await batch.commit();

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
                score: analysisResult.contentScore,
                status: "채점 완료",
                studentFeedbackSummary: "학생이 평가에 대해 남긴 피드백이 없습니다.",
            };
            await updateDoc(newResultRef, finalResultData);
            setResult({ id: newResultRef.id, ...initialData, ...finalResultData } as StudentResult);
            setStatus("채점 완료");
            
            const assessmentRef = doc(db, "assessments", assessment.id);
            const allResultsQuery = query(collection(db, "results"), where("assessmentId", "==", assessment.id), where("status", "==", "채점 완료"));
            const querySnapshot = await getDocs(allResultsQuery);
            const scores = querySnapshot.docs.map(d => (d.data() as StudentResult).score || 0);
            const newSubmissionCount = scores.length;
            const newAverage = newSubmissionCount > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / newSubmissionCount) : 0;
            await updateDoc(assessmentRef, { submissionCount: newSubmissionCount, averageScore: newAverage });

        } catch (e: any) {
            console.error("Error generating feedback:", e);
            setError("AI 분석 중 오류가 발생했습니다: " + e.message);
            setStatus("오류");
            toast({ title: "피드백 생성 오류", description: "피드백을 생성하는 중 오류가 발생했습니다.", variant: "destructive" });
            if (newResultRef) {
                await updateDoc(newResultRef, { status: '오류', aiFeedback: `AI 분석 중 오류가 발생했습니다: ${e.message}` });
            }
        } finally {
            setIsLoading(false);
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
    }, [user, toast, router]);

    useEffect(() => {
        if(authLoading) return;
        if(!user) {
            router.push('/');
            return;
        }

        const storedDataString = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (!storedDataString) {
            toast({
                title: "오류",
                description: "분석할 대화 기록을 찾을 수 없습니다. 대시보드로 돌아갑니다.",
                variant: "destructive"
            });
            router.push('/student/dashboard');
            return;
        }

        const storedData: StoredSessionData = JSON.parse(storedDataString);
        generateFeedback(storedData);
        
    }, [user, authLoading, router, toast, generateFeedback]);


    if (isLoading || authLoading) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 h-96">
                <AnalysisProgressView currentStep={analysisStep} />
            </div>
        );
    }
  
    if (error || status === '오류') {
      return (
          <Card className="flex flex-col items-center justify-center text-center p-8 h-80 bg-destructive/10 border-destructive">
              <CardHeader>
                  <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <CardTitle className="text-destructive">분석 오류</CardTitle>
                  <CardDescription className="text-destructive-foreground">{error || "AI가 답변을 분석하는 데 실패했습니다. 다시 시도해주세요."}</CardDescription>
              </CardHeader>
          </Card>
      );
    }

    if (!result) {
        return <div className="text-center p-8">피드백을 불러오지 못했습니다.</div>;
    }


    return (
        <div className="space-y-6">
            <FeedbackView result={result} />
            <div className="text-center">
                <Button onClick={() => router.push('/student/dashboard')}>대시보드로 돌아가기</Button>
            </div>
        </div>
    );
}
