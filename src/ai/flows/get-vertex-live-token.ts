'use server';
import { requireUser } from '@/lib/auth-guard';

/**
 * @fileOverview Vertex AI Live 접속용 단기 토큰을 발급합니다.
 *
 * 기존 Gemini Live 도구(get-live-session-token)는 API 키 '원본' 을 브라우저로
 * 내려보냅니다. 교사 한 명이 쓸 때는 감수했지만, 학생 수십 명에게 열면 학교
 * 유료 키가 그 수만큼 복사됩니다. 한 번 새어 나가면 키를 교체할 때까지
 * 누구나 학교 과금으로 쓸 수 있습니다.
 *
 * Gemini API 의 임시 토큰(auth_tokens)은 이 프로젝트에서 동작하지 않았습니다
 * (발급은 되지만 접속이 'unregistered callers' 로 거부 — 전달 방식 8가지 확인).
 * Vertex AI Live 는 OAuth 토큰을 신원으로 인정하므로 이쪽을 씁니다.
 *
 * 그래서 다음을 지킵니다.
 *  - 토큰은 약 1시간 뒤 만료됩니다. 새어 나가도 수명이 있습니다.
 *  - 전용 서비스 계정에 Vertex AI 사용자 권한만 부여합니다. Firebase 서비스
 *    계정을 재사용하면 Firestore·Storage 까지 함께 열려 더 위험합니다.
 *  - 브라우저는 WebSocket 에 Authorization 헤더를 붙일 수 없어 ?access_token=
 *    으로 넘깁니다(실측으로 받아들여지는 것을 확인했습니다).
 */

import { GoogleAuth } from 'google-auth-library';

/**
 * 모델이 제공되는 리전. 목록 조회로 확인한 값입니다.
 * 'use server' 파일은 async 함수만 export 할 수 있어 상수는 내부에만 둡니다.
 */
const VERTEX_LIVE_LOCATION = 'us-central1';

type VertexLiveSession = {
  accessToken: string;
  project: string;
  location: string;
  /** setup 에 넣을 전체 모델 경로 */
  modelPath: string;
  /** 브라우저가 그대로 열면 되는 주소 */
  wsUrl: string;
};

export async function getVertexLiveToken(input?: { model?: string }): Promise<VertexLiveSession> {
  // 학생도 응시해야 하므로 교사 제한을 두지 않습니다. 다만 로그인은 필요합니다.
  await requireUser();

  const raw = process.env.VERTEX_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('VERTEX_SERVICE_ACCOUNT_KEY 가 설정되지 않았습니다. 실시간 대화를 시작할 수 없습니다.');
  }

  let credentials: { project_id?: string };
  try {
    credentials = JSON.parse(raw);
  } catch {
    // 전에 Firebase 키를 붙여넣을 때 작은따옴표가 같이 들어가 운영에서만 실패한 적이 있습니다.
    throw new Error('VERTEX_SERVICE_ACCOUNT_KEY 형식이 올바르지 않습니다. JSON 원문이 { 로 시작해 } 로 끝나는지 확인하십시오.');
  }

  const project = credentials.project_id;
  if (!project) throw new Error('서비스 계정 키에 project_id 가 없습니다.');

  const auth = new GoogleAuth({
    credentials: credentials as any,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const accessToken = (await (await auth.getClient()).getAccessToken()).token;
  if (!accessToken) throw new Error('Vertex AI 접속 토큰을 발급받지 못했습니다.');

  const model = input?.model || 'gemini-3.8-live';

  return {
    accessToken,
    project,
    location: VERTEX_LIVE_LOCATION,
    modelPath: `projects/${project}/locations/${VERTEX_LIVE_LOCATION}/publishers/google/models/${model}`,
    wsUrl: `wss://${VERTEX_LIVE_LOCATION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent?access_token=${accessToken}`,
  };
}
