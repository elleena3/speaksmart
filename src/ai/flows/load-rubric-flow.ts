'use server';

/**
 * @fileOverview 평가에 연결된 루브릭을 불러옵니다.
 *
 * 예전에는 평가 문서에 loadedRubricId 를 저장해 두고도 이를 읽는 코드가 없어서,
 * 교사가 만든 루브릭이 채점에 전혀 반영되지 않았습니다.
 * 응시·재채점 경로가 모두 이 함수를 거쳐 루브릭 항목을 가져갑니다.
 */

import { assessmentRef } from '@/lib/server-store';
import { getAdminDb } from '@/lib/firebase-admin';
import { type RubricCriterion } from '@/lib/types/ai-schemas';

export type LoadedRubric = {
  name: string;
  criteria: RubricCriterion[];
};

/** 루브릭 문서를 읽어 항목을 돌려줍니다. 없거나 비어 있으면 null. */
export async function loadRubricById(rubricId: string): Promise<LoadedRubric | null> {
  if (!rubricId) return null;

  try {
    const snap = await getAdminDb().collection('rubrics').doc(rubricId).get();
    if (!snap.exists) {
      console.warn('루브릭 문서를 찾을 수 없습니다:', rubricId);
      return null;
    }

    const data = snap.data() as { name?: string; criteria?: RubricCriterion[] } | undefined;
    const criteria = (data?.criteria ?? []).filter((c) => c?.name && typeof c.maxScore === 'number');
    if (criteria.length === 0) {
      console.warn('루브릭에 유효한 항목이 없습니다:', rubricId);
      return null;
    }

    return { name: data?.name ?? '루브릭', criteria };
  } catch (e) {
    console.error('루브릭을 불러오지 못했습니다:', e);
    return null;
  }
}

/**
 * 평가 문서에서 루브릭을 찾아 돌려줍니다.
 * 재채점 경로는 평가 ID만 알고 있으므로 이 형태가 필요합니다.
 */
export async function loadRubricForAssessment(assessmentId: string): Promise<LoadedRubric | null> {
  try {
    const snap = await assessmentRef(assessmentId).get();
    if (!snap.exists) return null;

    const data = snap.data() as { useRubric?: boolean; loadedRubricId?: string } | undefined;
    if (!data?.useRubric || !data.loadedRubricId) return null;

    return loadRubricById(data.loadedRubricId);
  } catch (e) {
    console.error('평가의 루브릭을 불러오지 못했습니다:', e);
    return null;
  }
}
