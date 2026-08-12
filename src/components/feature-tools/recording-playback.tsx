"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Link2, Check, AlertTriangle } from "lucide-react";
import { type UploadState } from "@/lib/upload-recording";
import { RecordedAudio } from "./recorded-audio";

/**
 * 대화 녹음을 그 자리에서 들어보고, 내려받고, 보관 링크를 복사하는 패널.
 *
 * 두 실시간 대화 도구가 같은 방식으로 녹음하므로 UI 를 공유합니다.
 * 분석이 실패해도 녹음은 남아 있어야 하므로 결과 카드와 별개로 렌더링합니다.
 */
export function RecordingPlayback({
  url,
  fileName,
  storedUrl,
  uploadState = 'idle',
  uploadError,
}: {
  /** 방금 녹음한 blob URL. 즉시 재생용이며 탭을 닫으면 사라집니다. */
  url: string;
  fileName: string;
  /** Storage 에 보관된 영구 URL */
  storedUrl?: string | null;
  uploadState?: UploadState;
  uploadError?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!storedUrl) return;
    try {
      await navigator.clipboard.writeText(storedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없으면 사용자가 직접 링크를 열어 복사할 수 있게 둡니다.
      window.open(storedUrl, '_blank');
    }
  };

  return (
    <div className="mt-4 rounded-lg border bg-muted/40 p-3 space-y-2">
      <p className="text-sm font-medium">내 대화 녹음</p>
      {/* MediaRecorder webm 은 길이 정보가 없어 그냥 물리면 재생이 안 되는 것처럼 보입니다.
          RecordedAudio 가 길이를 보정합니다. */}
      <RecordedAudio src={url} />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {uploadState === 'uploading' && (
            <><Loader2 className="h-3 w-3 animate-spin" /> 보관용으로 업로드 중…</>
          )}
          {uploadState === 'done' && (
            <><Check className="h-3 w-3 text-emerald-600" /> 서버에 보관되었습니다. 리포트에 링크가 포함됩니다.</>
          )}
          {uploadState === 'error' && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-3 w-3" /> 보관 실패: {uploadError ?? '알 수 없는 오류'} (다운로드는 가능합니다)
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {storedUrl && (
            <Button size="sm" variant="outline" onClick={copyLink}>
              <Link2 className="h-4 w-4 mr-2" /> {copied ? '복사됨' : '보관 링크 복사'}
            </Button>
          )}
          <Button size="sm" variant="outline" className="border-blue-200 bg-blue-50 hover:bg-blue-100" asChild>
            <a href={url} download={fileName} className="flex items-center">
              <Download className="h-4 w-4 mr-2" /> 음성 파일 다운로드
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
