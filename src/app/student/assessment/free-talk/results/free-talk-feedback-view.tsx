
"use client"

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { generateComprehensiveFeedback, GenerateComprehensiveFeedbackOutput } from "@/ai/flows/generate-comprehensive-feedback";
import { type ConversationHistory, type StudentResult, type TeacherAssessment } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { FeedbackView } from "../../[id]/results/feedback-view";

const SESSION_STORAGE_KEY = 'freeTalkConversationHistory';


export function FreeTalkFeedbackView() {
    const [isLoading, setIsLoading] = useState(true);
    const [result, setResult] = useState<StudentResult | null>(null);
    const [assessmentDetails, setAssessmentDetails] = useState<TeacherAssessment | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const assessmentId = searchParams.get('id');

    useEffect(() => {
        const storedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (!assessmentId || !storedData) {
            toast({
                title: "오류",
                description: "분석할 대화 기록이나 평가 정보를 찾을 수 없습니다. 대시보드로 돌아갑니다.",
                variant: "destructive"
            });
            router.push('/student/dashboard');
            return;
        }

        const allAssessments: TeacherAssessment[] = JSON.parse(localStorage.getItem('assessments') || '[]');
        const currentAssessment = allAssessments.find(a => a.id === assessmentId);
        
        if(!currentAssessment) {
             toast({
                title: "평가 정보 없음",
                description: "평가 정보를 찾을 수 없습니다.",
                variant: "destructive"
            });
            router.push('/student/dashboard');
            return;
        }
        setAssessmentDetails(currentAssessment);

        const conversationData: ConversationHistory = JSON.parse(storedData);
        generateFeedback(conversationData, currentAssessment);
        
    }, [assessmentId, router, toast]);

    const generateFeedback = async (conversationData: ConversationHistory, assessment: TeacherAssessment) => {
        setIsLoading(true);
        try {
            const fakeAudioDataUri = "data:audio/webm;base64,"; 
            
            const fullTranscript = conversationData.history
                .map(turn => `${turn.role === 'user' ? '학생' : 'AI'}: ${turn.text}`)
                .join('\n');
            
            const generatedResult = await generateComprehensiveFeedback({
                activityPrompt: `${assessment.prompt}\n\n--- 대화 기록 ---\n${fullTranscript}`,
                expectedFormat: "AI와의 자연스러운 대화 능력을 평가합니다. 유창성, 발음, 어휘, 문법을 종합적으로 고려하여 피드백을 제공해주세요.",
                studentRecordingDataUri: fakeAudioDataUri,
                studentName: "Alex Doe", 
                assessmentTitle: assessment.title,
            });

            const score = generatedResult.score;

            const studentResult: StudentResult = {
                studentId: "student-alex-doe",
                assessmentId: assessment.id,
                assessmentTitle: assessment.title,
                name: "Alex Doe",
                avatarUrl: "https://placehold.co/40x40.png",
                status: "채점 완료",
                score: score,
                date: new Date().toISOString().split('T')[0],
                aiFeedback: generatedResult.aiFeedback,
                curricularRemarks: generatedResult.curricularRemarks,
                studentFeedbackSummary: "학생이 평가에 대해 남긴 피드백이 없습니다.",
                teacherGuidance: generatedResult.teacherGuidance,
                studentTranscript: fullTranscript
            }
            
            const existingResults: StudentResult[] = JSON.parse(localStorage.getItem('student_results') || '[]');
            const updatedResults = [...existingResults.filter(r => r.assessmentId !== assessmentId), studentResult];
            localStorage.setItem('student_results', JSON.stringify(updatedResults));
            
            setResult(studentResult);

        } catch (error) {
            console.error("Error generating feedback:", error);
            toast({
                title: "피드백 생성 오류",
                description: "피드백을 생성하는 중 오류가 발생했습니다.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
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
            <FeedbackView 
                assessmentId={result.assessmentId}
                assessmentTitle={result.assessmentTitle}
                aiFeedback={result.aiFeedback}
                studentTranscript={result.studentTranscript || "대화 기록이 없습니다."}
                studentRecordingDataUri={undefined}
            />
            <div className="text-center">
                <Button onClick={() => router.push('/student/dashboard')}>대시보드로 돌아가기</Button>
            </div>
        </div>
    );
}
