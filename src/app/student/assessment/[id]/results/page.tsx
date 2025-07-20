
"use client";

import { FeedbackView } from "./feedback-view"
import { GrowthView } from "./growth-view"
import { useParams, useRouter, notFound, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from "react";
import { type StudentResult, type TeacherAssessment } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2, AlertTriangle, CheckCircle2, UploadCloud, AudioLines, FileScan, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db, storage } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, getDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { generateMonologueAnalysis } from "@/ai/flows/generate-monologue-analysis-flow";
import { ref, uploadString, getDownloadURL } from "firebase/storage";

const SESSION_STORAGE_KEY = 'monologueSessionData';

type AnalysisStep = "transcribe" | "analyze" | "upload" | "report";
type PageStatus = "loading" | "analyzing" | "completed" | "error";

const analysisSteps: { key: AnalysisStep, text: string, icon: React.FC<any> }[] = [
    { key: "transcribe", text: "음성을 텍스트로 변환", icon: AudioLines },
    { key: "analyze", text: "내용 및 발음 분석", icon: FileScan },
    { key: "upload", text: "답변 파일 저장", icon: UploadCloud },
    { key: "report", text: "최종 리포트 생성", icon: Sparkles },
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


export default function AssessmentResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [results, setResults] = useState<StudentResult[]>([]);
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep | null>(null);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [errorInfo, setErrorInfo] = useState<{ message: string } | null>(null);
  
  const isProcessing = useRef(false);

  const processMonologueSubmission = useCallback(async (sessionData: MonologueSessionData) => {
    if (!user || isProcessing.current) return;
    
    isProcessing.current = true;
    setStatus("analyzing");
    setErrorInfo(null);

    const { assessmentDetails, studentRecordingDataUri } = sessionData;
    
    const resultDocRef = await addDoc(collection(db, "results"), {
        studentId: user.uid,
        assessmentId: assessmentDetails.id,
        assessmentTitle: assessmentDetails.title,
        teacherUid: assessmentDetails.uid,
        name: user.displayName || "Student",
        avatarUrl: user.photoURL || '',
        createdAt: Date.now(),
        date: new Date().toISOString(),
        status: "분석 중",
    });

    try {
        setAnalysisStep("transcribe");
        const analysisPromise = generateMonologueAnalysis({
            studentRecordingUrl: studentRecordingDataUri,
            activityPrompt: assessmentDetails.prompt,
            expectedFormat: assessmentDetails.expectedFormat || "",
            studentName: user.displayName || "Student",
            assessmentTitle: assessmentDetails.title,
            evaluationModel: assessmentDetails.evaluationModel,
            useRubric: assessmentDetails.useRubric || false,
        });
        
        // While AI is analyzing, start uploading the file in parallel
        setAnalysisStep("analyze"); 
        const storageRef = ref(storage, `recordings/${user.uid}_${assessmentDetails.id}_${Date.now()}.webm`);
        const uploadPromise = uploadString(storageRef, studentRecordingDataUri, 'data_url');
        
        const [analysisResult, uploadSnapshot] = await Promise.all([analysisPromise, uploadPromise]);
        
        setAnalysisStep("upload");
        const downloadURL = await getDownloadURL(uploadSnapshot.ref);

        setAnalysisStep("report");
        await updateDoc(resultDocRef, {
            ...analysisResult,
            studentRecordingUrl: downloadURL,
            status: '채점 완료',
        });
        
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
      if (e.message && (e.message.includes("overloaded") || e.message.includes("503"))) {
          errorMessage = "AI 모델이 과부하 상태입니다. 잠시 후 다시 시도하거나, 교사에게 문의하여 다른 AI 모델로 평가를 변경해달라고 요청할 수 있습니다.";
      } else {
          errorMessage = `AI 분석 중 오류가 발생했습니다: ${e.message}`;
      }
      setErrorInfo({ message: errorMessage });
      setStatus("error");
      await updateDoc(resultDocRef, { 
          status: '오류', 
          aiFeedback: errorMessage
      });
    } finally {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        isProcessing.current = false;
    }
  }, [user, id]);


  useEffect(() => {
    if (authLoading || !user || !id) return;
    
    // Check for new submission data first.
    const sessionDataRaw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionDataRaw && !isProcessing.current) {
        const sessionData = JSON.parse(sessionDataRaw);
        if (sessionData.assessmentId === id) {
            processMonologueSubmission(sessionData);
            return;
        }
    }
    
    const q = query(
        collection(db, "results"),
        where("assessmentId", "==", id),
        where("studentId", "==", user.uid)
    );

    const handleSnapshot = async (snapshot: any) => {
        if (isProcessing.current) return;

        if (snapshot.empty) {
            const assessmentRef = doc(db, 'assessments', id as string);
            const assessmentSnap = await getDoc(assessmentRef);
            if (assessmentSnap.exists()) {
                setAssessment({id: assessmentSnap.id, ...assessmentSnap.data()} as TeacherAssessment);
                setResults([]);
                setStatus("completed");
            } else {
                notFound();
            }
            return;
        }

        const dbResults: StudentResult[] = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        dbResults.sort((a, b) => (a.createdAt || 0) - (a.createdAt || 0));
        
        if (!assessment) {
            const assessmentRef = doc(db, 'assessments', id as string);
            const assessmentSnap = await getDoc(assessmentRef);
            if (assessmentSnap.exists()) {
                setAssessment({id: assessmentSnap.id, ...assessmentSnap.data()} as TeacherAssessment);
            }
        }
        
        setResults(dbResults);
        const latestResult = dbResults[dbResults.length - 1];
        
        if (latestResult) {
            if (latestResult.status === '채점 완료') {
                setStatus("completed");
                setAnalysisStep(null);
            } else if (latestResult.status === '오류') {
                setStatus('error');
                setErrorInfo({ message: latestResult.aiFeedback || '알 수 없는 오류가 발생했습니다.' });
            } else if (latestResult.status === '분석 중') {
                setStatus('analyzing');
            } else { // Handle legacy or stuck statuses
                 setStatus('error');
                 setErrorInfo({ message: '이전 분석이 비정상적으로 종료되었습니다. 평가로 돌아가 다시 시도해주세요.'});
            }
        }
    }
    
    const handleError = (err: any) => {
        console.error("Error listening to result:", err);
        setErrorInfo({ message: "결과를 실시간으로 업데이트하는 중 오류가 발생했습니다."});
        setStatus("error");
    }

    const unsubscribe = onSnapshot(q, handleSnapshot, handleError);
    return () => unsubscribe();
  }, [id, user, authLoading, processMonologueSubmission, assessment]);
  
  if (status === "loading" || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 h-96">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
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

  if (status === 'completed' && assessment) {
    const completedResults = results.filter(r => r.status === '채점 완료');
    if (completedResults.length === 0) {
      return (
         <div className="text-center p-8">
             <p>이 평가에 대한 제출된 결과가 없습니다. 평가를 먼저 완료해주세요.</p>
             <Button onClick={() => router.push(`/student/assessment/${id}`)} className="mt-4">평가 시작하기</Button>
         </div>
      );
    }
    
    if (completedResults.length === 1) {
      return <FeedbackView result={completedResults[0]} assessment={assessment} isLatestAttempt={true} />;
    }

    if (completedResults.length > 1) {
      const attemptNumber = searchParams.get('attempt');
      return <GrowthView results={completedResults} assessment={assessment} defaultTab={`attempt-${attemptNumber || completedResults.length}`} />;
    }
  }

  return null;
}

    