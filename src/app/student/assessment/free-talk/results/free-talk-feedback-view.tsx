
"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Lightbulb, BookUser, Star } from "lucide-react";
import { generateFreeTalkFeedback, GenerateFreeTalkFeedbackOutput } from "@/ai/flows/generate-free-talk-feedback";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type FeedbackViewProps = {
  assessmentTitle: string;
  mockFeedback: GenerateFreeTalkFeedbackOutput; // Using mock for now
};

type RubricCategory = 'fluency' | 'pronunciation' | 'vocabulary' | 'grammar';

const rubricLabels: Record<RubricCategory, string> = {
  fluency: '유창성',
  pronunciation: '발음',
  vocabulary: '어휘',
  grammar: '문법'
};

const RubricScore = ({ score, category }: { score: number, category: RubricCategory }) => (
  <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className={`w-5 h-5 ${i < score ? 'text-yellow-400 fill-yellow-400' : 'text-muted'}`} />
        ))}
      </div>
      <Badge variant="outline">{rubricLabels[category]}</Badge>
  </div>
);

export function FreeTalkFeedbackView({ assessmentTitle, mockFeedback }: FeedbackViewProps) {
  const [feedback, setFeedback] = useState<GenerateFreeTalkFeedbackOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const getFeedback = async () => {
      const storedConversation = localStorage.getItem('freeTalkConversation');
      if (!storedConversation) {
        toast({
          title: "오류",
          description: "대화 기록을 찾을 수 없습니다. 다시 시도해 주세요.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      try {
        const conversation = JSON.parse(storedConversation);
        const transcript = conversation.map((m: {speaker: string, text: string}) => `${m.speaker}: ${m.text}`).join('\n');
        
        // This call is commented out to use mock data instead.
        // Uncomment this to use the actual AI flow.
        /*
        const result = await generateFreeTalkFeedback({
          conversationTranscript: transcript
        });
        setFeedback(result);
        */

        // Using mock data for demonstration
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
        setFeedback(mockFeedback);

      } catch (error) {
        console.error("Error generating feedback:", error);
        toast({
          title: "피드백 생성 오류",
          description: "AI 피드백을 생성하는 중 문제가 발생했습니다.",
          variant: "destructive"
        });
        // You might want to set mock feedback here as a fallback
        setFeedback(mockFeedback);
      } finally {
        setIsLoading(false);
      }
    };

    getFeedback();
  }, [toast, mockFeedback]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">AI가 대화를 분석하고 있습니다...</p>
      </div>
    );
  }

  if (!feedback) {
    return (
       <Alert variant="destructive">
        <AlertTitle>피드백을 불러올 수 없습니다</AlertTitle>
        <AlertDescription>
          피드백을 생성하는데 실패했습니다. 다시 시도해주세요.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{assessmentTitle}</CardTitle>
            <CardDescription>AI가 생성한 상세 분석 결과입니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">종합 평가</h3>
              <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">{feedback.studentFeedback.overall}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">영역별 평가 (루브릭)</h3>
              <div className="space-y-4">
                {Object.entries(feedback.studentFeedback.rubric).map(([category, details]) => (
                   <div key={category} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start p-4 border rounded-lg">
                      <div className="md:col-span-1 flex justify-center">
                        <RubricScore score={details.score} category={category as RubricCategory} />
                      </div>
                      <div className="md:col-span-2">
                         <p className="text-sm text-muted-foreground">{details.feedback}</p>
                      </div>
                   </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/student/dashboard')}>대시보드로 돌아가기</Button>
          </CardFooter>
        </Card>
      </div>
      <div>
        <Card className="sticky top-8">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Lightbulb className="w-8 h-8 text-yellow-400 shrink-0"/>
                    <div>
                        <CardTitle>교사 지도 방향</CardTitle>
                        <CardDescription>AI가 제안하는 선생님을 위한 가이드입니다.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="p-4 bg-primary/10 rounded-lg text-sm text-primary-foreground/90 space-y-2">
                    <p className="font-sans text-black">{feedback.teacherGuidance}</p>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
