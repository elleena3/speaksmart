
"use client";

import { FeedbackView } from "./feedback-view"
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from "react";
import { type StudentResult, type ResultStatus, type TeacherAssessment } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2, AlertTriangle, CheckCircle2, UploadCloud, AudioLines, FileScan, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db, storage } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, getDocs } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
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


// This component now handles the entire result creation and feedback display process.
export default function AssessmentResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [result, setResult] = useState<StudentResult | null>(null);
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep | null>(null);
  const [status, setStatus] = useState<ResultStatus>("분석 중");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const processMonologueSubmission = useCallback(async () => {
    const newSubmissionRaw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!newSubmissionRaw || !user) return;
    
    const { assessmentId, studentRecordingDataUri, assessmentDetails } = JSON.parse(newSubmissionRaw) as { assessmentId: string, studentRecordingDataUri: string, assessmentDetails: TeacherAssessment };
    
    if (assessmentId !== id) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
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
            status: "파일 업로드 중...",
        };
        await setDoc(newResultRef, initialData, { merge: true });

        const storageRef = ref(storage, `recordings/${user.uid}_${assessmentDetails.id}_${Date.now()}.webm`);
        await uploadString(storageRef, studentRecordingDataUri, 'data_url');
        const downloadURL = await getDownloadURL(storageRef);

        await updateDoc(newResultRef, { status: "텍스트 변환 중" });
        setAnalysisStep("transcribe");
        
        const analysisResult = await generateMonologueAnalysis({
            studentRecordingDataUri: studentRecordingDataUri,
            activityPrompt: assessmentDetails.prompt,
            expectedFormat: assessmentDetails.expectedFormat || "",
            studentName: user.displayName || "Student",
            assessmentTitle: assessmentDetails.title,
        });

        await updateDoc(newResultRef, { status: "내용 및 발음 분석 중..." });
        setAnalysisStep("analyze");
        
        await updateDoc(newResultRef, { status: "리포트 생성 중" });
        setAnalysisStep("report");

        const finalResultData: Partial<StudentResult> = {
            ...analysisResult,
            score: analysisResult.contentScore,
            studentRecordingDataUri: downloadURL,
            status: '채점 완료',
        };
        await updateDoc(newResultRef, finalResultData);
        
        // Update assessment aggregates
        const assessmentRef = doc(db, "assessments", assessmentDetails.id);
        const resultsCollection = collection(db, "results");
        const q = query(resultsCollection, where("assessmentId", "==", assessmentDetails.id), where("status", "==", "채점 완료"));

        const querySnapshot = await getDocs(q);
        const scores = querySnapshot.docs.map(d => (d.data() as StudentResult).score || 0);
        const newSubmissionCount = scores.length;
        const newAverage = newSubmissionCount > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / newSubmissionCount) : 0;
        
        await updateDoc(assessmentRef, {
            submissionCount: newSubmissionCount,
            averageScore: newAverage
        });

    } catch (e: any) {
      console.error("Error generating analysis:", e);
      setError("AI 분석 중 오류가 발생했습니다: " + e.message);
      setStatus("오류");
      await updateDoc(newResultRef, { 
          status: '오류', 
          aiFeedback: `AI 분석 중 오류가 발생했습니다: ${e.message}` 
      });
    } finally {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [id, user, toast]);

  useEffect(() => {
    if (authLoading || !user || !id) return;
    
    const mockData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    
    const q = query(
        collection(db, "results"),
        where("assessmentId", "==", id),
        where("studentId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const docToProcess = snapshot.docs.sort((a,b) => (b.data().createdAt || 0) - (a.data().createdAt || 0))[0];
            const data = { id: docToProcess.id, ...docToProcess.data() } as StudentResult;
            
            setResult(data);
            setStatus(data.status);

            if (data.status === '채점 완료' || data.status === '오류') {
                setIsLoading(false);
            } else {
                setIsLoading(true); 
            }
        } else if (mockData) {
            setIsLoading(true); 
            processMonologueSubmission();
        } else {
            setIsLoading(false);
        }
    }, (err) => {
        console.error("Error listening to result:", err);
        setError("결과를 실시간으로 업데이트하는 중 오류가 발생했습니다.");
        setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, [id, user, authLoading, router, processMonologueSubmission]);
  
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
                <CardDescription className="text-destructive-foreground">{error || result?.aiFeedback || "AI가 답변을 분석하는 데 실패했습니다. 다시 시도해주세요."}</CardDescription>
            </CardHeader>
        </Card>
    );
  }

  if (!result) {
     return (
        <div className="text-center p-8">
            <p>이 평가에 대한 제출된 결과가 없습니다. 평가를 먼저 완료해주세요.</p>
            <Button onClick={() => router.push(`/student/assessment/${id}`)} className="mt-4">평가 시작하기</Button>
        </div>
     );
  }

  return (
    <FeedbackView result={result} />
  )
}
