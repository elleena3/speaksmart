/**
 * @fileOverview 학생 마이크만 따로 녹음하는 보조 레코더.
 *
 * 대화 녹음은 학생 목소리와 AI 목소리가 한 스트림으로 섞여 있어(재생·다운로드용),
 * 그대로 발음 평가에 넣으면 AI 음성까지 채점됩니다.
 * 그래서 마이크만 담는 트랙을 하나 더 두고, 발음 분석에는 이쪽만 보냅니다.
 */

export type StudentMicRecorder = {
  /** 녹음을 멈추고 지금까지의 음성을 data URI 로 돌려줍니다. 녹음이 없으면 null. */
  stopAndGetDataUri: () => Promise<string | null>;
};

/**
 * 마이크 노드만 연결된 별도 목적지를 만들어 녹음을 시작합니다.
 * 합본 녹음(mixDest)에는 영향을 주지 않습니다.
 */
export function startStudentMicRecorder(
  audioCtx: AudioContext,
  micNode: AudioNode
): StudentMicRecorder {
  const micDest = audioCtx.createMediaStreamDestination();
  micNode.connect(micDest);

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(micDest.stream, { mimeType: 'audio/webm' });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();

  return {
    stopAndGetDataUri: () =>
      new Promise((resolve) => {
        if (recorder.state !== 'recording') {
          resolve(null);
          return;
        }

        // 분석은 이 결과를 기다려야 하므로 onstop 을 여기서 연결합니다.
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          if (blob.size === 0) {
            resolve(null);
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        };

        recorder.stop();
      }),
  };
}
