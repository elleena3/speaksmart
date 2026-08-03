"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";


/**
 * 대화 녹음을 그 자리에서 들어보고 내려받는 패널.
 *
 * 두 실시간 대화 도구가 같은 방식으로 녹음하므로 UI 를 공유합니다.
 * 분석이 실패해도 녹음은 남아 있어야 하므로, 결과 카드와 별개로 렌더링합니다.
 */
export function RecordingPlayback({
  url,
  fileName,
}: {
  url: string;
  fileName: string;
}) {
  return (
    <div className="mt-4 rounded-lg border bg-muted/40 p-3 space-y-2">
      <p className="text-sm font-medium">내 대화 녹음</p>
      {/* controls 를 주면 재생·일시정지·탐색·볼륨을 브라우저가 제공합니다. */}
      <audio controls src={url} className="w-full" preload="metadata" />
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="border-blue-200 bg-blue-50 hover:bg-blue-100" asChild>
          <a href={url} download={fileName} className="flex items-center">
            <Download className="h-4 w-4 mr-2" /> 음성 파일 다운로드
          </a>
        </Button>
      </div>
    </div>
  );
}
