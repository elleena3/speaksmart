
"use client";

import { FeedbackView } from "./feedback-view"
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from "react";
import { type StudentResult, type ResultStatus, type TeacherAssessment } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db, storage, firebaseConfig } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { generateMonologueAnalysis } from "@/ai/flows/generate-monologue-analysis-flow";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

const SESSION_STORAGE_KEY = 'monologueResult';

// This component now handles the entire result creation and feedback display process.
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
  const { toast } = useToast();

  const generateResultFromSubmission = useCallback(async () => {
    const newSubmissionRaw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!newSubmissionRaw || !user) return;
    
    const { assessmentId, studentRecordingDataUri, assessmentDetails } = JSON.parse(newSubmissionRaw) as { assessmentId: string, studentRecordingDataUri: string, assessmentDetails: TeacherAssessment };
    
    // Ensure this submission is for the current assessment page
    if (assessmentId !== id) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        return;
    }
    
    let newResultRef = doc(collection(db, "results"));
    
    try {
        // Step 1: Create an initial 'in-progress' document in Firestore
        setStatus("업로드 중");
        setProgress(10);
        
        const initialData: Partial<StudentResult> = {
            studentId: user.uid,
            assessmentId: assessmentDetails.id,
            assessmentTitle: assessmentDetails.title,
            teacherUid: assessmentDetails.uid,
            name: user.displayName || "Student",
            avatarUrl: user.photoURL || '',
            createdAt: Date.now(),
            date: new Date().toISOString(),
            status: "업로드 중",
            progress: 10,
        };
        await setDoc(newResultRef, initialData, { merge: true });

        // Step 2: Upload audio to Firebase Storage
        setStatus("파일 업로드 중...");
        await updateDoc(newResultRef, { status: "파일 업로드 중...", progress: 25 });
        const fetchRes = await fetch(studentRecordingDataUri);
        const audioBlob = await fetchRes.blob();
        const audioFileName = `recordings/${user.uid}_${assessmentDetails.id}_${Date.now()}.weba`;
        const storageRef = ref(storage, audioFileName);
        await uploadBytes(storageRef, audioBlob);
        const downloadURL = await getDownloadURL(storageRef);
        const bucket = firebaseConfig.storageBucket?.replace(".appspot.com", "");
        const gcsUri = `gs://${bucket}/${storageRef.fullPath}`;

        // Step 3: Call the AI flow with the GCS URI
        setStatus("AI 분석 중");
        setProgress(50);
        await updateDoc(newResultRef, { status: "AI 분석 중", progress: 50 });
        
        // Use the new monologue-specific flow
        const analysisResult = await generateMonologueAnalysis({
            studentRecordingGcsUri: gcsUri,
            activityPrompt: assessmentDetails.prompt,
            expectedFormat: assessmentDetails.expectedFormat || "",
            studentName: user.displayName || "Student",
            assessmentTitle: assessmentDetails.title,
        });
        
        // Step 4: Update the document with the full analysis results
        setStatus("리포트 생성 중");
        setProgress(90);

        const finalResultData: Partial<StudentResult> = {
            ...analysisResult,
            score: analysisResult.contentScore,
            studentRecordingDataUri: downloadURL, // Persist Storage URL for playback
            status: '채점 완료',
            progress: 100
        };
        await updateDoc(newResultRef, finalResultData);
        
        // Step 5: Update the assessment's average score
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
      // Update the doc to show error state
      await updateDoc(newResultRef, { 
          status: '오류', 
          progress: 100, 
          aiFeedback: `AI 분석 중 오류가 발생했습니다: ${e.message}` 
      });
    } finally {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        // The listener will pick up the final changes
    }
  }, [id, user, toast]);

  useEffect(() => {
    if (authLoading || !user || !id) return;
    
    const mockData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    
    // Set up a real-time listener for results for this user and assessment.
    // This will show existing results OR the result being created by generateResultFromSubmission.
    const q = query(
        collection(db, "results"),
        where("assessmentId", "==", id),
        where("studentId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            // Assume the most recent one is the correct one.
            const docToProcess = snapshot.docs.sort((a,b) => (b.data().createdAt || 0) - (a.data().createdAt || 0))[0];
            const data = { id: docToProcess.id, ...docToProcess.data() } as StudentResult;
            
            setResult(data);
            setStatus(data.status);
            setProgress(data.progress || 0);

            if (data.status === '채점 완료' || data.status === '오류') {
                setIsLoading(false);
            } else {
                setIsLoading(true); // Keep loading if still processing
            }
        } else if (mockData) {
            // Only generate if there are no existing results AND there is new data
            setIsLoading(true); // Show loading state while processing
            generateResultFromSubmission();
        } else {
            // If no results found and none are being generated, stop loading.
            setIsLoading(false);
        }
    }, (err) => {
        console.error("Error listening to result:", err);
        setError("결과를 실시간으로 업데이트하는 중 오류가 발생했습니다.");
        setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, [id, user, authLoading, router, generateResultFromSubmission]);
  
  if (isLoading || authLoading) {
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
