"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck } from "lucide-react";
import { type RubricEvaluation, type RubricScores } from "@/lib/types";

/**
 * 루브릭 채점 결과 카드.
 *
 * 새 채점(rubricEvaluation)은 교사가 만든 항목을 그대로 보여줍니다.
 * 예전에 채점된 결과는 고정 5항목(rubricScores)만 갖고 있어, 그쪽도 계속 표시되도록
 * 두 형태를 함께 받습니다.
 */

const LEGACY_LABELS: { key: keyof RubricScores; label: string }[] = [
  { key: 'fluency', label: '유창성' },
  { key: 'pronunciation', label: '발음 및 억양' },
  { key: 'grammar', label: '문법' },
  { key: 'vocabulary', label: '어휘' },
  { key: 'interaction', label: '내용 이해 및 상호작용' },
];

export function RubricResultCard({
  evaluation,
  legacyScores,
  rubricName,
}: {
  evaluation?: RubricEvaluation | null;
  legacyScores?: RubricScores | null;
  rubricName?: string | null;
}) {
  // 새 형식이 있으면 그것을 우선합니다.
  const rows = evaluation
    ? evaluation.criteria.map((c) => ({
        name: c.name,
        score: c.score,
        maxScore: c.maxScore,
        feedback: c.feedback,
      }))
    : legacyScores
      ? LEGACY_LABELS
          .filter((l) => typeof legacyScores[l.key] === 'number')
          .map((l) => ({
            name: l.label,
            score: legacyScores[l.key] as number,
            maxScore: 5, // 예전 채점은 항목당 5점 만점 고정이었습니다.
            feedback: '',
          }))
      : [];

  if (rows.length === 0) return null;

  const total = evaluation?.totalScore ?? rows.reduce((s, r) => s + r.score, 0);
  const totalMax = evaluation?.totalMaxScore ?? rows.reduce((s, r) => s + r.maxScore, 0);
  const percent = totalMax > 0 ? Math.round((total / totalMax) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          루브릭 채점 결과
          {rubricName && <span className="text-sm font-normal text-muted-foreground">— {rubricName}</span>}
        </CardTitle>
        <div className="flex justify-between text-sm pt-1">
          <span className="text-muted-foreground">총점</span>
          <span className="font-semibold">{total} / {totalMax}점 (100점 환산 {percent}점)</span>
        </div>
        <Progress value={percent} className="h-2 mt-1" />
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((r, i) => (
          <div key={`${r.name}-${i}`} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{r.name}</span>
              <span className="text-muted-foreground">{r.score} / {r.maxScore}</span>
            </div>
            <Progress value={r.maxScore > 0 ? (r.score / r.maxScore) * 100 : 0} className="h-1.5" />
            {r.feedback && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{r.feedback}</p>
            )}
          </div>
        ))}

        {evaluation?.summary && (
          <div className="border-t pt-3 text-sm whitespace-pre-wrap leading-relaxed">
            {evaluation.summary}
          </div>
        )}

        {!evaluation && legacyScores && (
          <p className="border-t pt-3 text-xs text-muted-foreground">
            예전 방식으로 채점된 결과입니다. 항목이 5개로 고정되어 있어 교사가 만든 루브릭과 다를 수 있습니다.
            정확한 점수가 필요하면 다시 채점해주세요.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
