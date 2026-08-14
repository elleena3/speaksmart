/**
 * @fileOverview 쉐도잉 연습 기록.
 *
 * 문장 하나를 여러 번 반복해 점수가 오르는 것을 보는 게 이 연습의 핵심이라,
 * 시도할 때마다 결과를 남깁니다.
 *
 * 클라이언트 SDK 로 직접 씁니다. 소유자 검사는 firestore.rules 가 합니다.
 * (서버 액션을 새로 만들 필요가 없고, 규칙이 유일한 경계라 새는 곳이 없습니다.)
 */

import {
  addDoc, collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export const SHADOWING_COLLECTION = 'shadowingRecords';

export type ShadowingRecord = {
  id?: string;
  uid: string;
  /** 연습한 문장. 지문 전체가 아니라 그때 실제로 읽은 부분입니다. */
  sentence: string;
  /** 같은 문장을 모아 보기 위한 열쇠. 문장 자체는 길어서 따로 둡니다. */
  sentenceKey: string;
  overallScore: number;
  pronunciationScore: number;
  intonationScore: number;
  syncScore: number;
  completionRate: number;
  /** 브라우저가 실제로 잰 지연(ms). 재지 못했으면 null. */
  measuredLagMs: number | null;
  createdAt: number;
};

/** 같은 문장인지 판단할 열쇠. 공백과 문장부호 차이는 무시합니다. */
export function sentenceKeyOf(sentence: string): string {
  return sentence.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 120);
}

export async function saveShadowingRecord(
  record: Omit<ShadowingRecord, 'uid' | 'sentenceKey' | 'createdAt'>
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return; // 로그인 전이면 조용히 넘어갑니다. 연습 자체를 막을 이유는 없습니다.

  await addDoc(collection(db, SHADOWING_COLLECTION), {
    ...record,
    uid,
    sentenceKey: sentenceKeyOf(record.sentence),
    createdAt: Date.now(),
  });
}

/** 이 문장을 지금까지 몇 번, 몇 점으로 연습했는지 가져옵니다. */
export async function loadSentenceHistory(sentence: string, max = 20): Promise<ShadowingRecord[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  const snapshot = await getDocs(query(
    collection(db, SHADOWING_COLLECTION),
    where('uid', '==', uid),
    where('sentenceKey', '==', sentenceKeyOf(sentence)),
    orderBy('createdAt', 'desc'),
    limit(max),
  ));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ShadowingRecord, 'id'>) }));
}
