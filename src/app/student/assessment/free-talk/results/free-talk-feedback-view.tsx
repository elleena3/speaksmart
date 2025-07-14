
"use client"

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { generateComprehensiveFeedback } from "@/ai/flows/generate-comprehensive-feedback";
import { type StudentResult, type TeacherAssessment } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { FeedbackView } from "../../[id]/results/feedback-view";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, writeBatch } from "firebase/firestore";

const SESSION_STORAGE_KEY = 'freeTalkConversationHistory';

type StoredConversationData = {
    history: any[];
    studentRecordingDataUri: string;
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
            
            const fullTranscript = history
                .map(turn => `${turn.role === 'user' ? '학생' : 'AI'}: ${turn.text}`)
                .join('\n');
            
            const generatedResult = await generateComprehensiveFeedback({
                activityPrompt: `${assessment.prompt}\n\n--- 대화 기록 ---\n${fullTranscript}`,
                expectedFormat: assessment.expectedFormat || "AI와의 자연스러운 대화 능력을 평가합니다.",
                studentRecordingDataUri: studentRecordingDataUri,
                studentName: user.displayName || "Student", 
                assessmentTitle: assessment.title.replace(' - 복사본', ''),
            });

            const resultData: Omit<StudentResult, 'id'> = {
                studentId: user.uid,
                assessmentId: assessment.id,
                assessmentTitle: assessment.title,
                name: user.displayName || "Student",
                avatarUrl: user.photoURL || `https://placehold.co/40x40.png?text=${user.displayName?.charAt(0)}`,
                status: "채점 완료",
                score: generatedResult.score,
                date: new Date().toISOString().split('T')[0],
                createdAt: Date.now(),
                aiFeedback: generatedResult.aiFeedback,
                curricularRemarks: generatedResult.curricularRemarks,
                studentFeedbackSummary: "학생이 평가에 대해 남긴 피드백이 없습니다.",
                teacherGuidance: generatedResult.teacherGuidance,
                studentTranscript: fullTranscript,
                studentRecordingDataUri: studentRecordingDataUri,
                pronunciationScore: generatedResult.pronunciationScore,
                pronunciationFeedback: generatedResult.pronunciationFeedback,
                teacherUid: assessment.uid,
            };

            // Atomically add the new result and delete any old one for this assessment
            const resultsRef = collection(db, "results");
            const q = query(resultsRef, where("assessmentId", "==", assessment.id), where("studentId", "==", user.uid));
            const existingDocs = await getDocs(q);

            const batch = writeBatch(db);
            existingDocs.forEach(doc => batch.delete(doc.ref)); // Delete old results
            const newResultRef = doc(collection(db, "results"));
            batch.set(newResultRef, resultData); // Add new result
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
                <p className="text-muted-foreground">AI가 대화 내용을 바탕으로 상세 피드백을 생성하고 있습니다.</p>
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
