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
  /**
   * 녹음을 멈추고 Blob 으로 돌려줍니다. 녹음이 없으면 null.
   *
   * 평가 응시는 이 녹음을 Storage 에 올려야 합니다. data URI 로 받으면 base64 로
   * 3분의 1쯤 커지고, 화면 사이로 넘기려면 sessionStorage(약 5MB)에 담아야 해서
   * 긴 대화에서 터집니다. Blob 이면 그대로 업로드할 수 있습니다.
   */
  stopAndGetBlob: () => Promise<Blob | null>;
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

  /** 녹음을 멈추고 모인 조각을 Blob 으로 만듭니다. 빈 녹음은 null. */
  const stopAndGetBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      if (recorder.state !== 'recording') {
        resolve(null);
        return;
      }

      // 분석은 이 결과를 기다려야 하므로 onstop 을 여기서 연결합니다.
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        resolve(blob.size === 0 ? null : blob);
      };

      recorder.stop();
    });

  return {
    stopAndGetBlob,
    stopAndGetDataUri: async () => {
      const blob = await stopAndGetBlob();
      if (!blob) return null;
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    },
  };
}
