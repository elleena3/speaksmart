/**
 * @fileOverview 활동 산출물 기록.
 *
 * 원본 영상·녹음은 분석이 끝나면 지웁니다. 남겨야 하는 것은 그 결과입니다.
 * 도구마다 컬렉션을 따로 두면 보안 규칙이 계속 늘어나므로 한곳에 모으고
 * type 으로 구분합니다. 도구별로 다른 값은 detail 에 담습니다.
 *
 * 클라이언트 SDK 로 직접 씁니다. 소유자 검사는 firestore.rules 가 합니다.
 */

import {
  addDoc, collection, deleteDoc, doc, getDocs, limit as limitTo, orderBy, query, where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export const ACTIVITY_COLLECTION = 'activityRecords';

export type ActivityType = 'shadowing' | 'presentation';

export type ActivityRecord = {
  id?: string;
  uid: string;
  type: ActivityType;
  /** 목록에 보일 이름. 쉐도잉은 연습한 문장, 발표는 파일 이름입니다. */
  title: string;
  /** 같은 대상을 모아 보기 위한 열쇠 */
  subjectKey: string;
  /** 목록에서 한눈에 볼 대표 점수 */
  score: number;
  /** 도구마다 다른 값 */
  detail: Record<string, number | string | null>;
  createdAt: number;
};

/** 같은 대상인지 판단할 열쇠. 공백과 문장부호 차이는 무시합니다. */
export function subjectKeyOf(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9가-힣]/g, '').slice(0, 120);
}

export async function saveActivityRecord(
  record: Omit<ActivityRecord, 'uid' | 'subjectKey' | 'createdAt'> & { subjectKey?: string }
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return; // 로그인 전이면 조용히 넘어갑니다. 활동 자체를 막을 이유는 없습니다.

  await addDoc(collection(db, ACTIVITY_COLLECTION), {
    ...record,
    uid,
    subjectKey: record.subjectKey ?? subjectKeyOf(record.title),
    createdAt: Date.now(),
  });
}

/** 내 기록을 최신순으로 가져옵니다. subject 를 주면 그 대상만 봅니다. */
export async function loadActivityRecords(options: {
  type: ActivityType;
  subject?: string;
  limit?: number;
}): Promise<ActivityRecord[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  const conditions = [
    where('uid', '==', uid),
    where('type', '==', options.type),
    ...(options.subject ? [where('subjectKey', '==', subjectKeyOf(options.subject))] : []),
  ];

  const snapshot = await getDocs(query(
    collection(db, ACTIVITY_COLLECTION),
    ...conditions,
    orderBy('createdAt', 'desc'),
    limitTo(options.limit ?? 50),
  ));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityRecord, 'id'>) }));
}

export async function deleteActivityRecord(id: string): Promise<void> {
  await deleteDoc(doc(db, ACTIVITY_COLLECTION, id));
}
