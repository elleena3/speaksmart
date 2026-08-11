"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { type RubricCriterion } from "@/lib/types";

/**
 * 루브릭 항목·배점·수준 설명을 표로 보여 주는 미리보기.
 *
 * 평가 생성 화면에만 있던 것을 수정 화면에서도 쓸 수 있게 분리했습니다.
 * 예전에는 iframe 에 HTML 문자열을 만들어 넣었는데, 루브릭 이름이나 설명에
 * 꺾쇠가 들어가면 화면이 깨지므로 React 로 그립니다.
 */
export function RubricPreviewDialog({
  name,
  criteria,
  trigger,
}: {
  name: string;
  criteria: RubricCriterion[];
  trigger?: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
            <Eye className="mr-2 h-4 w-4" /> 자세히 보기
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {criteria.map((c, i) => (
            <div key={`${c.name}-${i}`} className="space-y-2">
              <h3 className="font-semibold">
                {c.name} <span className="text-sm font-normal text-muted-foreground">(만점 {c.maxScore}점)</span>
              </h3>
              {c.details?.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 w-20">점수</th>
                        <th className="text-left p-2">설명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.details.map((d, j) => (
                        <tr key={j} className="border-t">
                          <td className="p-2 align-top">{d.score}점</td>
                          <td className="p-2">{d.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          <p className="text-xs text-muted-foreground border-t pt-3">
            총 {criteria.length}개 항목 / 합계 {criteria.reduce((s, c) => s + (c.maxScore || 0), 0)}점 만점.
            채점은 이 항목과 배점을 그대로 사용합니다.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
