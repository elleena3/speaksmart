
"use client";

import { FeedbackView } from "./feedback-view"
import { useParams, useRouter, notFound } from 'next/navigation';
import { useEffect, useState, useCallback } from "react";
import { type StudentResult, type ResultStatus } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { generateSpeakingAnalysis } from "@/ai/flows/generate-speaking-analysis-flow";

const MOCK_SESSION_KEY = 'mockResult';

// This function now only runs on the client to listen for existing results.
// Result creation is handled entirely by the server-side flow.
export default function AssessmentResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [result, setResult] = useState<StudentResult | null>(null);
  const [status, setStatus] = useState<ResultStatus>("분석 중");
  const [progress, setProgress] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newResultId, setNewResultId] = useState<string | null>(null);

  // This function now just triggers the AI flow and gets the new result ID back.
  const generateResultFromSubmission = useCallback(async () => {
    const newSubmissionRaw = sessionStorage.getItem(MOCK_SESSION_KEY);
    if (!newSubmissionRaw || !user) return;
    
    const { assessmentId, studentRecordingDataUri, assessmentDetails } = JSON.parse(newSubmissionRaw);

    if (assessmentId !== id) {
        sessionStorage.removeItem(MOCK_SESSION_KEY);
        return;
    }
    
    try {
        const { resultId } = await generateSpeakingAnalysis({
            studentRecordingDataUri,
            activityPrompt: assessmentDetails.prompt,
            expectedFormat: assessmentDetails.expectedFormat || "",
            studentName: user.displayName || "Student",
            assessmentTitle: assessmentDetails.title,
            studentId: user.uid,
            teacherUid: assessmentDetails.uid,
            avatarUrl: user.photoURL || '',
            assessmentId: assessmentDetails.id
        });
        
        // The flow returns the ID of the new document.
        // We'll use this ID to listen for the result.
        setNewResultId(resultId);
        
    } catch (e) {
      console.error("Error generating analysis:", e);
      setError("AI 분석 중 오류가 발생했습니다.");
      setStatus("오류");
      setIsLoading(false);
    } finally {
        // Clear session storage immediately after starting the flow.
        sessionStorage.removeItem(MOCK_SESSION_KEY);
    }
  }, [id, user]);

  useEffect(() => {
    if (authLoading || !user || !id) return;
    
    const mockData = sessionStorage.getItem(MOCK_SESSION_KEY);
    if (mockData) {
        generateResultFromSubmission();
        // Return here and let the next effect run when newResultId is set
        return;
    }

    // If we have a newResultId, we should listen to that specific document.
    // Otherwise, query for an existing result for this user/assessment.
    const resultDocId = newResultId;

    if (resultDocId) {
        const docRef = doc(db, "results", resultDocId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() } as StudentResult;
                setResult(data);
                setStatus(data.status);
                setProgress(data.progress || 100);

                if (data.status === '채점 완료' || data.status === '오류') {
                    setIsLoading(false);
                }
            }
        }, (err) => {
            console.error("Error listening to new result:", err);
            setError("결과를 실시간으로 업데이트하는 중 오류가 발생했습니다.");
            setIsLoading(false);
        });
        return () => unsubscribe();
    } else {
        // Query for existing result if no new one is being generated
        const q = query(
            collection(db, "results"),
            where("assessmentId", "==", id),
            where("studentId", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const docToProcess = snapshot.docs[0];
                const data = { id: docToProcess.id, ...docToProcess.data() } as StudentResult;
                setResult(data);
                setStatus(data.status);
                setProgress(data.progress || 100);

                if (data.status === '채점 완료' || data.status === '오류') {
                    setIsLoading(false);
                }
            } else {
                setIsLoading(false); 
            }
        }, (err) => {
            console.error("Error fetching result:", err);
            setError("결과를 불러오는 중 오류가 발생했습니다.");
            setIsLoading(false);
        });
        return () => unsubscribe();
    }
  }, [id, user, authLoading, router, generateResultFromSubmission, newResultId]);
  
  if (isLoading || authLoading) {
    return (
      <Card className="flex flex-col items-center justify-center text-center p-8 h-96">
        <CardHeader>
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <CardTitle>AI 분석 진행 중</CardTitle>
          <CardDescription>결과를 서버로부터 불러오고 있습니다. 잠시만 기다려주세요.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status !== '채점 완료' && status !== '오류' && newResultId) {
     return (
        <Card className="flex flex-col items-center justify-center text-center p-8 h-96">
            <CardHeader>
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <CardTitle>AI 분석 진행 중: {status}</CardTitle>
                <CardDescription>답변을 분석하고 있습니다. 이 과정은 최대 1-2분 소요될 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent className="w-full max-w-sm">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground mt-2">{progress}% 완료</p>
            </CardContent>
        </Card>
     )
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
            <p>평가 결과를 찾을 수 없습니다.</p>
        </div>
     );
  }

  return (
    <FeedbackView result={result} />
  )
}
