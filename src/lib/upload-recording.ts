/**
 * @fileOverview 대화 녹음을 Firebase Storage 에 보관합니다.
 *
 * 브라우저가 만든 blob URL 은 탭을 닫으면 사라져서, 리포트만 남기면
 * 나중에 음성을 다시 들을 방법이 없습니다. 보관용 URL 을 따로 만들어 둡니다.
 *
 * 저장 경로는 storage.rules 의 `recordings/{fileName}` 규칙과 맞춰 한 단계로 둡니다.
 * (하위 폴더를 만들면 그 규칙에 걸리지 않습니다.)
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';

/** storage.rules 에 걸어둔 업로드 크기 제한과 같은 값입니다. */
const MAX_BYTES = 20 * 1024 * 1024;

export type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export async function uploadConversationRecording(blob: Blob, prefix: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('로그인 상태가 아니어서 녹음을 보관할 수 없습니다.');
  }

  if (blob.size > MAX_BYTES) {
    const mb = (blob.size / 1024 / 1024).toFixed(1);
    throw new Error(`녹음 파일이 너무 큽니다(${mb}MB). 20MB 이하만 보관됩니다.`);
  }

  const objectRef = ref(storage, `recordings/${prefix}_${uid}_${Date.now()}.webm`);
  await uploadBytes(objectRef, blob, { contentType: 'audio/webm' });
  return getDownloadURL(objectRef);
}
