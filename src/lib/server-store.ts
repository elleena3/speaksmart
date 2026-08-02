/**
 * @fileOverview 서버(Genkit 플로우, 서버 액션)에서 Firestore/Storage에 접근하기 위한 헬퍼.
 *
 * 서버에는 로그인 세션이 없어 클라이언트 SDK를 쓰면 보안 규칙에서 request.auth 가 null 이 됩니다.
 * 규칙을 제대로 잠그려면 서버 쪽 접근은 반드시 Admin SDK를 거쳐야 하므로,
 * 플로우들이 공통으로 쓰는 동작만 얇게 감싸 둡니다.
 *
 * 사전 조건: 환경 변수 FIREBASE_SERVICE_ACCOUNT_KEY 설정
 * (설정 방법은 src/lib/firebase-admin.ts 상단 주석 참고)
 */

import { v4 as uuidv4 } from 'uuid';
import { getAdminDb, getAdminStorage } from './firebase-admin';

/** results/{id} 문서 참조 */
export function resultRef(resultId: string) {
  return getAdminDb().collection('results').doc(resultId);
}

/** assessments/{id} 문서 참조 */
export function assessmentRef(assessmentId: string) {
  return getAdminDb().collection('assessments').doc(assessmentId);
}

/** 특정 평가에 속한 모든 결과 문서 */
export async function resultsByAssessment(assessmentId: string) {
  return getAdminDb().collection('results').where('assessmentId', '==', assessmentId).get();
}

/**
 * data: URL 을 Storage에 업로드하고 클라이언트가 그대로 쓸 수 있는 다운로드 URL을 돌려줍니다.
 * 클라이언트 SDK의 uploadString(..., 'data_url') + getDownloadURL 조합을 대체합니다.
 */
export async function uploadDataUrl(objectPath: string, dataUrl: string): Promise<string> {
  // target이 ES2017이라 정규식 s 플래그를 쓸 수 없어 [\s\S] 로 대신합니다.
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) {
    throw new Error('올바른 data URL 형식이 아닙니다.');
  }

  const [, contentType, base64Flag, payload] = match;
  const buffer = base64Flag
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  // 다운로드 토큰을 직접 심어야 클라이언트가 쓰는 형태의 URL을 만들 수 있습니다.
  const downloadToken = uuidv4();
  const bucket = getAdminStorage().bucket();
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    contentType,
    metadata: {
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;
}

/**
 * 저장된 다운로드 URL(또는 gs:// 주소, 객체 경로)에서 객체 경로만 뽑아냅니다.
 * 클라이언트 SDK의 ref(storage, url) 이 해 주던 일입니다.
 */
export function objectPathFromUrl(urlOrPath: string): string {
  if (urlOrPath.startsWith('gs://')) {
    // gs://<bucket>/<path>
    return urlOrPath.replace(/^gs:\/\/[^/]+\//, '');
  }

  if (urlOrPath.startsWith('http')) {
    // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded path>?alt=media&token=...
    const match = /\/o\/([^?]+)/.exec(urlOrPath);
    if (!match) {
      throw new Error(`Storage 경로를 해석할 수 없는 URL 입니다: ${urlOrPath}`);
    }
    return decodeURIComponent(match[1]);
  }

  return urlOrPath;
}

/** 저장된 URL이 가리키는 파일의 바이트를 읽어옵니다. */
export async function downloadBytes(urlOrPath: string): Promise<Buffer> {
  const [buffer] = await getAdminStorage().bucket().file(objectPathFromUrl(urlOrPath)).download();
  return buffer;
}
