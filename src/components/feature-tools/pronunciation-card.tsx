"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AudioLines } from "lucide-react";
import { shortModelName } from "@/lib/evaluation-models";
import { type PronunciationAnalysis } from "@/ai/flows/analyze-live-conversation-flow";

/**
 * 발음·억양 평가 카드.
 *
 * 이 항목만은 자막이 아니라 학생의 실제 음성을 듣고 매깁니다.
 * 소리를 처리할 수 있는 모델이 Gemini 뿐이라, 대화를 다른 모델로 했더라도
 * 여기는 Gemini 가 평가합니다. 그 사실을 카드에 밝혀 둡니다.
 */
export function PronunciationCard({ analysis }: { analysis: PronunciationAnalysis }) {
  return (
    <Card className="border-amber-100 dark:border-amber-900">
      <CardHeader className="pb-2 bg-amber-50/50 dark:bg-amber-950/20">
        <CardTitle className="text-base text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <AudioLines className="h-4 w-4" /> 발음 및 억양 (Pronunciation)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          실제 음성을 듣고 평가했습니다. 음성 분석은 {shortModelName(analysis.model)} 가 수행합니다.
        </p>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">발음 점수</span>
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">{analysis.pronunciationScore} / 100</span>
          </div>
          <Progress value={analysis.pronunciationScore} className="h-2" />
        </div>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {analysis.pronunciationFeedback}
        </div>
      </CardContent>
    </Card>
  );
}
