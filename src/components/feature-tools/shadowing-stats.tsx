"use client";

/**
 * 쉐도잉 연습 통계.
 *
 * 쉐도잉은 같은 문장을 되풀이하며 조금씩 나아지는 연습이라, 한 번의 점수보다
 * 흐름이 중요합니다. 날짜별 추이와 자주 걸리는 문장을 보여 줍니다.
 *
 * 그래프 라이브러리를 새로 들이지 않고 막대만 그립니다. 값이 몇 개 안 되고,
 * 의존성을 늘리면 번들만 커집니다.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { loadActivityRecords, type ActivityRecord } from '@/lib/activity-records';
import { cn } from '@/lib/utils';
import { BarChart3, RefreshCw, Loader2 } from 'lucide-react';

type DayPoint = { day: string; average: number; count: number };

/** 날짜별 평균 점수. 하루에 여러 번 하면 평균을 냅니다. */
function byDay(records: ActivityRecord[]): DayPoint[] {
  const buckets = new Map<string, number[]>();
  for (const r of records) {
    const day = new Date(r.createdAt).toISOString().slice(5, 10).replace('-', '/');
    buckets.set(day, [...(buckets.get(day) ?? []), r.score]);
  }
  return [...buckets.entries()]
    .map(([day, scores]) => ({
      day,
      average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      count: scores.length,
    }))
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-14);
}

/** 평균이 낮은 문장부터. 다시 연습할 곳을 찾는 용도입니다. */
function weakestSentences(records: ActivityRecord[]) {
  const buckets = new Map<string, { title: string; scores: number[] }>();
  for (const r of records) {
    const entry = buckets.get(r.subjectKey) ?? { title: r.title, scores: [] };
    entry.scores.push(r.score);
    buckets.set(r.subjectKey, entry);
  }
  return [...buckets.values()]
    .map(({ title, scores }) => ({
      title,
      attempts: scores.length,
      average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      best: Math.max(...scores),
    }))
    .sort((a, b) => a.average - b.average)
    .slice(0, 5);
}

/** 오늘부터 거꾸로 세어 연속으로 연습한 날 수. */
function streakDays(records: ActivityRecord[]): number {
  const days = new Set(records.map((r) => new Date(r.createdAt).toDateString()));
  let streak = 0;
  const cursor = new Date();
  // 오늘 아직 안 했으면 어제부터 셉니다.
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function ShadowingStats({ onPractise }: { onPractise?: (sentence: string) => void }) {
  const [records, setRecords] = useState<ActivityRecord[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRecords(await loadActivityRecords({ type: 'shadowing', limit: 200 }));
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (records === null) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" />불러오는 중…
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />연습 통계
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          아직 기록이 없습니다. 쉐도잉을 한 번 하고 AI 평가를 받으면 여기에 쌓입니다.
        </CardContent>
      </Card>
    );
  }

  const days = byDay(records);
  const weak = weakestSentences(records);
  const best = Math.max(...records.map((r) => r.score));
  const average = Math.round(records.reduce((sum, r) => sum + r.score, 0) / records.length);
  const lags = records.map((r) => Number(r.detail?.lagMs)).filter((n) => Number.isFinite(n) && n > 0);
  const medianLag = lags.length ? [...lags].sort((a, b) => a - b)[Math.floor(lags.length / 2)] : null;

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />연습 통계
          </CardTitle>
          <CardDescription className="text-xs">
            총 {records.length}번 · 평균 {average}점 · 최고 {best}점
            {medianLag !== null && ` · 평소 간격 ${(medianLag / 1000).toFixed(1)}초`}
            {streakDays(records) > 0 && ` · ${streakDays(records)}일 연속`}
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">날짜별 평균</h4>
          <div className="flex items-end gap-1.5 h-24">
            {days.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.day} · ${d.count}번 · 평균 ${d.average}점`}>
                <span className="text-[10px] tabular-nums text-muted-foreground">{d.average}</span>
                <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(4, d.average * 0.6)}px` }} />
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">{d.day}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">더 연습하면 좋을 문장</h4>
          <ul className="space-y-1.5">
            {weak.map((w) => (
              <li key={w.title} className="flex items-center gap-2 text-sm">
                <span className={cn('tabular-nums font-semibold w-9 shrink-0',
                  w.average < 60 ? 'text-destructive' : w.average < 80 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                  {w.average}
                </span>
                <span className="flex-1 truncate" title={w.title}>{w.title}</span>
                <span className="text-xs text-muted-foreground shrink-0">{w.attempts}번 · 최고 {w.best}</span>
                {onPractise && (
                  <Button variant="outline" size="sm" className="h-7 shrink-0" onClick={() => onPractise(w.title)}>
                    다시 연습
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
