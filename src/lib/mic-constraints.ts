/**
 * @fileOverview 마이크 입력 제약.
 *
 * 실시간 대화에서는 AI 목소리가 스피커로 나오고, 그 소리가 다시 마이크로 들어옵니다.
 * 그대로 두면 AI 가 한 말이 학생 발화로 전사되어 문법·발음 점수가 오염됩니다.
 * 브라우저 기본값도 보통 에코 제거를 켜지만, 값이 바뀌어도 흔들리지 않도록 명시합니다.
 *
 * 헤드셋을 쓰면 애초에 문제가 없지만 교실에서는 스피커를 쓰는 경우가 많습니다.
 */
export const CONVERSATION_MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};
