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
  // MIME 타입에는 파라미터가 붙을 수 있습니다. 브라우저의 MediaRecorder 는
  // 'audio/webm;codecs=opus' 로 녹음하므로 실제 값은
  //   data:audio/webm;codecs=opus;base64,....
  // 입니다. 파라미터를 고려하지 않고 자르면 학생 녹음이 통째로 거부됩니다.
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma === -1) {
    throw new Error('올바른 data URL 형식이 아닙니다.');
  }

  // 'audio/webm;codecs=opus;base64' 처럼 base64 표시는 항상 맨 뒤에 옵니다.
  const segments = dataUrl.slice('data:'.length, comma).split(';');
  const isBase64 = segments[segments.length - 1].trim().toLowerCase() === 'base64';
  if (isBase64) segments.pop();

  const contentType = segments.join(';').trim() || 'text/plain;charset=US-ASCII';
  const payload = dataUrl.slice(comma + 1);
  const buffer = isBase64
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

/**
 * Storage 의 파일을 모델에 넘길 수 있는 data URL 로 읽어옵니다.
 *
 * 동영상·오디오를 브라우저에서 data URL 로 만들어 서버 액션 인자로 보내면
 * 배포 환경의 요청 본문 한도(실측 4.5MB)에 걸려 413 으로 거부됩니다.
 * 그래서 파일은 브라우저에서 Storage 로 올리고, 서버가 여기서 다시 읽습니다.
 */
/**
 * 화면에서 넘어온 미디어 입력을 모델이 받는 data URL 로 맞춥니다.
 *
 * 작은 파일은 그대로 data URL 로 넘어오고, 큰 파일은 Storage 에 올린 뒤
 * URL 만 넘어옵니다(요청 본문 한도 때문). 플로우는 둘을 구분할 필요가 없습니다.
 */
export async function resolveToDataUrl(input: string): Promise<string> {
  return input.startsWith('data:') ? input : downloadAsDataUrl(input);
}

export async function downloadAsDataUrl(urlOrPath: string): Promise<string> {
  const file = getAdminStorage().bucket().file(objectPathFromUrl(urlOrPath));
  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();
  const contentType = metadata.contentType || 'application/octet-stream';
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}
