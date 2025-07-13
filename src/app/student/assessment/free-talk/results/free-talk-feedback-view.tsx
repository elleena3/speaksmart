"use client"

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, ThumbsUp, ThumbsDown } from "lucide-react";
import { generateFreeTalkFeedback, GenerateFreeTalkFeedbackOutput } from "@/ai/flows/generate-free-talk-feedback";
import { type ConversationHistory } from "@/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const SESSION_STORAGE_KEY = 'freeTalkConversationHistory';

function RubricItem({ title, score, feedback }: { title: string, score: number, feedback: string }) {
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <h4 className="font-semibold">{title}</h4>
                <span className="text-sm font-mono">{score} / 5</span>
            </div>
            <Progress value={score * 20} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">{feedback}</p>
        </div>
    )
}

export function FreeTalkFeedbackView() {
    const [feedback, setFeedback] = useState<GenerateFreeTalkFeedbackOutput | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [satisfaction, setSatisfaction] = useState<"good" | "bad" | null>(null);
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const storedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (storedData) {
            const conversationData: ConversationHistory = JSON.parse(storedData);
            const fullTranscript = conversationData.history
                .map(turn => `${turn.role === 'user' ? 'Student' : 'AI'}: ${turn.text}`)
                .join('\n');

            generateFeedback(fullTranscript);
        } else {
            toast({
                title: "대화 기록 없음",
                description: "분석할 대화 기록을 찾을 수 없습니다. 대시보드로 돌아갑니다.",
                variant: "destructive"
            });
            router.push('/student/dashboard');
        }
    }, [router, toast]);

    const generateFeedback = async (conversationTranscript: string) => {
        setIsLoading(true);
        try {
            const result = await generateFreeTalkFeedback({ conversationTranscript });
            setFeedback(result);
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

    if (!feedback) {
        return <div className="text-center p-8">피드백을 불러오지 못했습니다.</div>;
    }

    const { studentFeedback, teacherGuidance } = feedback;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">자유 대화 결과</CardTitle>
                    <CardDescription>AI와의 대화를 바탕으로 한 종합 분석입니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">종합 평가</h3>
                        <p className="p-4 bg-muted/50 rounded-lg text-sm leading-relaxed">{studentFeedback.overall}</p>
                    </div>

                    <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                        <AccordionItem value="item-1">
                            <AccordionTrigger className="text-lg font-semibold">세부 평가 항목</AccordionTrigger>
                            <AccordionContent className="space-y-6 pt-4">
                                <RubricItem title="유창성 (Fluency)" {...studentFeedback.rubric.fluency} />
                                <RubricItem title="발음 (Pronunciation)" {...studentFeedback.rubric.pronunciation} />
                                <RubricItem title="어휘 (Vocabulary)" {...studentFeedback.rubric.vocabulary} />
                                <RubricItem title="문법 (Grammar)" {...studentFeedback.rubric.grammar} />
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                             <AccordionTrigger className="text-lg font-semibold">선생님을 위한 조언</AccordionTrigger>
                             <AccordionContent className="pt-4">
                                <p className="text-sm text-muted-foreground">{teacherGuidance}</p>
                             </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
                <CardFooter className="flex-col items-start gap-4">
                    <p className="text-sm font-medium">이 피드백이 도움이 되었나요?</p>
                    <div className="flex gap-2">
                        <Button variant={satisfaction === 'good' ? 'default' : 'outline'} onClick={() => setSatisfaction('good')}>
                            <ThumbsUp className="mr-2 h-4 w-4" /> 유용함
                        </Button>
                        <Button variant={satisfaction === 'bad' ? 'destructive' : 'outline'} onClick={() => setSatisfaction('bad')}>
                            <ThumbsDown className="mr-2 h-4 w-4" /> 유용하지 않음
                        </Button>
                    </div>
                </CardFooter>
            </Card>
            <div className="text-center">
                <Button onClick={() => router.push('/student/dashboard')}>대시보드로 돌아가기</Button>
            </div>
        </div>
    );
}
