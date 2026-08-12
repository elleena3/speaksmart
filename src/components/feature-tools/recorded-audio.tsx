"use client";

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * 녹음본 재생기.
 *
 * MediaRecorder 가 만든 webm 에는 길이 정보가 들어 있지 않습니다.
 * 그대로 <audio> 에 물리면 duration 이 Infinity 로 잡혀서
 * 진행바가 움직이지 않고 탐색도 되지 않습니다. 재생이 안 되는 것처럼 보입니다.
 * (실제로 측정해 확인했습니다: 129초짜리 녹음이 Infinity 로 나옵니다.)
 *
 * 아주 먼 지점으로 한 번 탐색을 걸면 브라우저가 길이를 계산합니다.
 * 그 뒤 처음으로 되돌리면 정상적인 재생기가 됩니다.
 */
export function RecordedAudio({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    setDuration(null);
    let done = false;

    const settle = () => {
      if (done || !Number.isFinite(el.duration)) return;
      done = true;
      setDuration(el.duration);
      el.currentTime = 0;
      el.removeEventListener('durationchange', settle);
      el.removeEventListener('timeupdate', settle);
    };

    const onMeta = () => {
      if (Number.isFinite(el.duration)) { settle(); return; }
      el.addEventListener('durationchange', settle);
      el.addEventListener('timeupdate', settle);
      // 끝을 넘어서는 지점을 요청하면 브라우저가 실제 길이를 찾아냅니다.
      el.currentTime = 1e101;
    };

    el.addEventListener('loadedmetadata', onMeta);
    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('durationchange', settle);
      el.removeEventListener('timeupdate', settle);
    };
  }, [src]);

  return (
    <div className={cn('space-y-1', className)}>
      <audio ref={ref} controls src={src} preload="metadata" className="w-full" />
      {duration !== null && (
        <p className="text-xs text-muted-foreground">
          녹음 길이 {Math.floor(duration / 60)}분 {Math.round(duration % 60)}초
        </p>
      )}
    </div>
  );
}
