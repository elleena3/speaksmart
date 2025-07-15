
"use client"

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { generateSpeakingAnalysis } from "@/ai/flows/generate-speaking-analysis-flow";
import { type StudentResult, type TeacherAssessment, type ConversationTurn } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { FeedbackView } from "../../../assessment/[id]/results/feedback-view";
import { useAuth } from "@/context/auth-context";
import { db, storage, firebaseConfig } from "@/lib/firebase";
import { collection, doc, query, where, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Card, CardHeader, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const SESSION_STORAGE_KEY = 'freeTalkSessionData';

type StoredSessionData = {
    studentRecordingDataUri: string;
    conversationHistory: ConversationTurn[];
    assessment: TeacherAssessment;
}

export function FreeTalkFeedbackView() {
    const { user, loading: authLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [result, setResult] = useState<StudentResult | null>(null);
    const [status, setStatus] = useState<string>("준비 중...");
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const router = useRouter();
    const { toast } = useToast();

    const generateFeedback = useCallback(async (sessionData: StoredSessionData) => {
        if (!user) return;
        setIsLoading(true);
        let newResultRef: any; 

        try {
            const { assessment, studentRecordingDataUri, conversationHistory } = sessionData;

            // Find if a result for this free-talk already exists to avoid duplicates
            const resultsQuery = query(collection(db, "results"), where("assessmentId", "==", assessment.id), where("studentId", "==", user.uid));
            const existingDocs = await getDocs(resultsQuery);

            if (!existingDocs.empty) {
                // If a result exists, update it. Take the most recent one.
                newResultRef = existingDocs.docs.sort((a,b) => (b.data().createdAt || 0) - (a.data().createdAt || 0))[0].ref;
            } else {
                // Otherwise, create a new one.
                newResultRef = doc(collection(db, "results"));
            }

            // 1. Create/update initial 'in-progress' document in Firestore
            setStatus("업로드 중");
            setProgress(10);
            const initialData: Partial<StudentResult> = {
                studentId: user.uid,
                assessmentId: assessment.id,
                assessmentTitle: assessment.title,
                teacherUid: assessment.uid,
                name: user.displayName || "Student",
                avatarUrl: user.photoURL || '',
                createdAt: Date.now(),
                date: new Date().toISOString(),
                status: "업로드 중",
                progress: 10,
            };
            await setDoc(newResultRef, initialData, { merge: true });

            // 2. Upload the combined student audio to Firebase Storage.
            setStatus("음성 파일 업로드 중...");
            setProgress(25);
            await updateDoc(newResultRef, { status: "음성 파일 업로드 중...", progress: 25 });
            const fetchRes = await fetch(studentRecordingDataUri);
            const audioBlob = await fetchRes.blob();
            const audioFileName = `recordings/${user.uid}_${assessment.id}_${Date.now()}.webm`;
            const storageRef = ref(storage, audioFileName);
            await uploadBytes(storageRef, audioBlob);
            const downloadURL = await getDownloadURL(storageRef);
            const bucket = firebaseConfig.storageBucket?.replace(".firebasestorage.app", "");
            const gcsUri = `gs://${bucket}/${storageRef.fullPath}`;

            const fullConversationTranscript = conversationHistory
                .map(turn => `${turn.role === 'user' ? '학생' : 'AI'}: ${turn.text}`)
                .join('\n');
                
            const studentOnlyTranscript = conversationHistory
                .filter(turn => turn.role === 'user')
                .map(turn => turn.text)
                .join(' ');


            // 3. Generate all feedback using the analysis flow with the GCS URI.
            setStatus("AI 분석 중...");
            setProgress(50);
            await updateDoc(newResultRef, { status: "AI 분석 중...", progress: 50 });
            
            const analysisResult = await generateSpeakingAnalysis({
                studentRecordingGcsUri: gcsUri,
                studentTranscript: studentOnlyTranscript, // Pass only the student's transcript for pronunciation analysis
                activityPrompt: `${assessment.prompt}\n\n--- 전체 대화 기록 ---\n${fullConversationTranscript}`, // Provide full context for content analysis
                expectedFormat: assessment.expectedFormat || "AI와의 자연스러운 대화 능력을 평가합니다.",
                studentName: user.displayName || "Student",
                assessmentTitle: assessment.title,
            });

            // 4. Prepare and save the final result data.
            setStatus("리포트 생성 중...");
            setProgress(90);
            
            const finalResultData: Partial<StudentResult> = {
                ...analysisResult,
                studentTranscript: fullConversationTranscript, // Save the full conversation for review
                score: analysisResult.contentScore,
                studentRecordingDataUri: downloadURL,
                status: "채점 완료",
                progress: 100,
                studentFeedbackSummary: "학생이 평가에 대해 남긴 피드백이 없습니다.", // Default value
            };

            await updateDoc(newResultRef, finalResultData);
            setResult({ id: newResultRef.id, ...initialData, ...finalResultData } as StudentResult);
            
            // 5. Update assessment aggregates
            const assessmentRef = doc(db, "assessments", assessment.id);
            const allResultsQuery = query(collection(db, "results"), where("assessmentId", "==", assessment.id), where("status", "==", "채점 완료"));
            const querySnapshot = await getDocs(allResultsQuery);
            const scores = querySnapshot.docs.map(d => (d.data() as StudentResult).score || 0);
            const newSubmissionCount = scores.length;
            const newAverage = newSubmissionCount > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / newSubmissionCount) : 0;
            
            await updateDoc(assessmentRef, {
                submissionCount: newSubmissionCount,
                averageScore: newAverage
            });


        } catch (e: any) {
            console.error("Error generating feedback:", e);
            setError("AI 분석 중 오류가 발생했습니다: " + e.message);
            setStatus("오류");
            toast({
                title: "피드백 생성 오류",
                description: "피드백을 생성하는 중 오류가 발생했습니다.",
                variant: "destructive"
            });
            if (newResultRef) {
                await updateDoc(newResultRef, { 
                    status: '오류', 
                    progress: 100, 
                    aiFeedback: `AI 분석 중 오류가 발생했습니다: ${e.message}` 
                });
            }
        } finally {
            setIsLoading(false);
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
    }, [user, toast]);

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
            <Card className="flex flex-col items-center justify-center text-center p-8 h-96">
                <CardHeader>
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <CardTitle>AI 분석 진행 중: {status}</CardTitle>
                    <CardDescription>대화 내용을 분석하고 있습니다. 이 과정은 최대 1-2분 소요될 수 있습니다.</CardDescription>
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
