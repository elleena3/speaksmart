
"use client"

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { generateSpeakingAnalysis } from "@/ai/flows/generate-speaking-analysis-flow";
import { type StudentResult, type TeacherAssessment } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { FeedbackView } from "../../../assessment/[id]/results/feedback-view";
import { useAuth } from "@/context/auth-context";
import { db, storage } from "@/lib/firebase";
import { collection, doc, query, where, getDocs, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const SESSION_STORAGE_KEY = 'freeTalkConversationHistory';

type StoredConversationData = {
    history: any[];
    studentRecordingDataUri: string; // This is the base64 URI
    assessment: TeacherAssessment;
}

export function FreeTalkFeedbackView() {
    const { user, loading: authLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [result, setResult] = useState<StudentResult | null>(null);

    const router = useRouter();
    const { toast } = useToast();

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

        const storedData: StoredConversationData = JSON.parse(storedDataString);
        generateFeedback(storedData);
        
    }, [user, authLoading, router, toast]);

    const generateFeedback = async (conversationData: StoredConversationData) => {
        if (!user) return;
        setIsLoading(true);
        try {
            const { assessment, history, studentRecordingDataUri } = conversationData;
            
            // 1. Upload audio to Firebase Storage first.
            const fetchRes = await fetch(studentRecordingDataUri);
            const audioBlob = await fetchRes.blob();
            const audioFileName = `recordings/${user.uid}_${assessment.id}_${Date.now()}.webm`;
            const storageRef = ref(storage, audioFileName);
            await uploadBytes(storageRef, audioBlob);
            const downloadURL = await getDownloadURL(storageRef);
            const gcsUri = `gs://${storageRef.bucket}/${storageRef.fullPath}`;

            // 2. Generate all feedback using the analysis flow with the GCS URI.
            const analysisResult = await generateSpeakingAnalysis({
                studentRecordingGcsUri: gcsUri,
                activityPrompt: assessment.prompt,
                expectedFormat: assessment.expectedFormat || "AI와의 자연스러운 대화 능력을 평가합니다.",
                studentName: user.displayName || "Student", 
                assessmentTitle: assessment.title.replace(/ - 복사본(\s\d+)?$/, ''),
            });

            // 3. Prepare the final result data.
            const resultData: Omit<StudentResult, 'id'> = {
                studentId: user.uid,
                assessmentId: assessment.id,
                assessmentTitle: assessment.title,
                name: user.displayName || "Student",
                avatarUrl: user.photoURL || `https://placehold.co/40x40.png?text=${user.displayName?.charAt(0)}`,
                status: "채점 완료",
                progress: 100,
                score: analysisResult.contentScore,
                date: new Date().toISOString().split('T')[0],
                createdAt: Date.now(),
                aiFeedback: analysisResult.aiFeedback,
                curricularRemarks: analysisResult.curricularRemarks,
                studentFeedbackSummary: "학생이 평가에 대해 남긴 피드백이 없습니다.",
                teacherGuidance: analysisResult.teacherGuidance,
                studentTranscript: analysisResult.studentTranscript,
                studentRecordingDataUri: downloadURL, // Use the Storage URL
                pronunciationScore: analysisResult.pronunciationScore,
                pronunciationFeedback: analysisResult.pronunciationFeedback,
                teacherUid: assessment.uid,
            };

            const resultsRef = collection(db, "results");
            const q = query(resultsRef, where("assessmentId", "==", assessment.id), where("studentId", "==", user.uid));
            const existingDocs = await getDocs(q);
            
            const batch = writeBatch(db);
            existingDocs.forEach(doc => batch.delete(doc.ref));
            const newResultRef = doc(collection(db, "results"));
            batch.set(newResultRef, resultData);
            await batch.commit();
            
            setResult({ id: newResultRef.id, ...resultData });

        } catch (error) {
            console.error("Error generating feedback:", error);
            toast({
                title: "피드백 생성 오류",
                description: "피드백을 생성하는 중 오류가 발생했습니다.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
    };

    if (isLoading || authLoading) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 border rounded-lg bg-muted/50 h-96">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <h2 className="text-xl font-semibold">대화 내용 분석 중...</h2>
                <p className="text-muted-foreground">AI가 대화 내용을 바탕으로 상세 피드백을 생성하고 있습니다. (최대 1-2분 소요)</p>
            </div>
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
