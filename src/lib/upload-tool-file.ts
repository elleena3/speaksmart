/**
 * @fileOverview 교사 도구가 쓰는 큰 파일을 Storage 에 먼저 올립니다.
 *
 * 동영상이나 긴 녹음을 data URL 로 만들어 서버 액션 인자로 넘기면
 * 배포 환경의 요청 본문 한도에 걸립니다. 실제로 재 보니 4.5MB 부터
 * HTTP 413 으로 거부됩니다(next.config 의 bodySizeLimit 과 무관한 플랫폼 한도).
 * base64 는 원본보다 33% 커지므로 3.2MB 짜리 영상도 통과하지 못합니다.
 *
 * 그래서 파일은 브라우저에서 Storage 로 올리고, 서버 액션에는 그 URL 만 넘깁니다.
 * 서버는 Admin SDK 로 다시 읽어 모델에 전달합니다(server-store 의 downloadAsDataUrl).
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';

/** storage.rules 의 uploads/{userId} 규칙에 걸어둔 값과 같습니다. */
export const MAX_TOOL_FILE_BYTES = 20 * 1024 * 1024;

export function describeFileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.round(bytes / 1024)}KB`;
}

/**
 * 이보다 크면 Storage 를 거칩니다.
 *
 * 배포 환경의 요청 본문 한도가 4.5MB 인데 base64 는 원본보다 33% 커지므로
 * 3.3MB 부터는 그냥 넘길 수 없습니다. 여유를 두고 2.5MB 로 잡았습니다.
 * 작은 파일까지 Storage 를 거치면 왕복이 늘고 쓰레기 파일만 쌓입니다.
 */
const INLINE_LIMIT_BYTES = 2.5 * 1024 * 1024;

/**
 * 서버 액션에 넘길 미디어 값을 만듭니다.
 *
 * 작으면 data URL 을 그대로, 크면 Storage 에 올린 뒤 그 URL 을 돌려줍니다.
 * 서버는 server-store 의 resolveToDataUrl 로 둘 다 받습니다.
 */
export async function prepareMediaInput(file: Blob, prefix: string, fileName?: string): Promise<string> {
  if (file.size > MAX_TOOL_FILE_BYTES) {
    throw new Error(
      `파일이 너무 큽니다(${describeFileSize(file.size)}). ` +
      `${describeFileSize(MAX_TOOL_FILE_BYTES)} 이하만 분석할 수 있습니다.`
    );
  }

  if (file.size > INLINE_LIMIT_BYTES) {
    return uploadToolFile(file, prefix, fileName);
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

/**
 * 파일을 uploads/{uid}/ 아래에 올리고 다운로드 URL 을 돌려줍니다.
 * 서버 액션에는 이 URL 만 넘기면 됩니다.
 */
export async function uploadToolFile(file: Blob, prefix: string, fileName?: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('로그인 상태가 아니어서 파일을 올릴 수 없습니다. 다시 로그인해주세요.');
  }

  if (file.size > MAX_TOOL_FILE_BYTES) {
    throw new Error(
      `파일이 너무 큽니다(${describeFileSize(file.size)}). ` +
      `${describeFileSize(MAX_TOOL_FILE_BYTES)} 이하만 올릴 수 있습니다. ` +
      '영상을 짧게 자르거나 화질을 낮춰 다시 시도해주세요.'
    );
  }

  // 확장자를 남겨 두면 Storage 콘솔에서 알아보기 쉽습니다.
  const extension = fileName?.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
  const objectRef = ref(storage, `uploads/${uid}/${prefix}_${Date.now()}${extension}`);
  await uploadBytes(objectRef, file, { contentType: file.type || 'application/octet-stream' });
  return getDownloadURL(objectRef);
}
