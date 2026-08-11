/**
 * @fileOverview 서버 액션 호출자 확인.
 *
 * 서버 액션은 인증 없이 누구나 POST 할 수 있는 엔드포인트입니다.
 * 액션 ID 는 공개된 JS 번들에 그대로 들어 있어 감춰지지도 않습니다.
 * 그래서 Firestore·Storage 를 건드리거나 유료 API 를 쓰는 액션은
 * 반드시 이 파일의 가드를 맨 앞에서 한 번 불러야 합니다.
 *
 * 쿠키는 /api/session 이 로그인 시에 심습니다.
 *
 * 'use server' 파일이 아니어야 상수·타입을 함께 export 할 수 있습니다.
 * 가드는 서버 액션의 본문(플로우 바깥)에서 부르십시오. next/headers 의
 * cookies() 는 요청 문맥에서만 동작합니다.
 */

import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

const SESSION_COOKIE_NAME = 'speaksmart_session';

export type Caller = {
  uid: string;
  role: 'teacher' | 'student';
};

/**
 * 운영자용 스크립트(scripts/)에서 플로우를 직접 부를 때만 씁니다.
 *
 * 배포 환경에서는 켤 수 없습니다. Vercel 은 VERCEL 환경 변수를 항상 채우므로
 * 실수로 대시보드에 넣더라도 무시됩니다.
 */
function isTrustedLocalScript(): boolean {
  return process.env.SPEAKSMART_TRUSTED_SCRIPT === '1' && !process.env.VERCEL;
}

const SCRIPT_CALLER: Caller = { uid: 'local-script', role: 'teacher' };

/** 로그인한 사용자인지 확인하고 호출자 정보를 돌려줍니다. */
export async function requireUser(): Promise<Caller> {
  if (isTrustedLocalScript()) return SCRIPT_CALLER;

  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) {
    throw new Error('로그인이 필요합니다.');
  }

  let uid: string;
  try {
    // checkRevoked=true 라야 로그아웃·계정 삭제가 즉시 반영됩니다.
    const decoded = await getAdminAuth().verifySessionCookie(cookie, true);
    uid = decoded.uid;
  } catch {
    throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.');
  }

  const snap = await getAdminDb().collection('users').doc(uid).get();
  const role = snap.data()?.role;
  if (!snap.exists || (role !== 'teacher' && role !== 'student')) {
    throw new Error('사용자 정보를 확인할 수 없습니다.');
  }

  return { uid, role };
}

/** 교사만 할 수 있는 작업에 씁니다. */
export async function requireTeacher(): Promise<Caller> {
  const caller = await requireUser();
  if (caller.role !== 'teacher') {
    throw new Error('교사 계정만 수행할 수 있는 작업입니다.');
  }
  return caller;
}

/**
 * 결과 문서를 건드릴 자격이 있는지 확인합니다.
 *
 * 결과 문서 ID 만 알면 누구나 학생 점수를 덮어쓸 수 있었습니다.
 * 본인 결과이거나, 그 평가를 만든 교사일 때만 허용합니다.
 */
export async function requireResultAccess(resultId: string): Promise<Caller> {
  if (isTrustedLocalScript()) return SCRIPT_CALLER;

  const caller = await requireUser();
  const snap = await getAdminDb().collection('results').doc(resultId).get();
  if (!snap.exists) {
    throw new Error('결과를 찾을 수 없습니다.');
  }

  const data = snap.data() as { studentId?: string; teacherUid?: string };
  const allowed =
    (caller.role === 'student' && data.studentId === caller.uid) ||
    (caller.role === 'teacher' && data.teacherUid === caller.uid);

  if (!allowed) {
    throw new Error('이 결과에 접근할 권한이 없습니다.');
  }
  return caller;
}

/** 평가를 만든 교사인지 확인합니다. 전체 재채점처럼 파급이 큰 작업에 씁니다. */
export async function requireAssessmentOwner(assessmentId: string): Promise<Caller> {
  if (isTrustedLocalScript()) return SCRIPT_CALLER;

  const caller = await requireTeacher();
  const snap = await getAdminDb().collection('assessments').doc(assessmentId).get();
  if (!snap.exists) {
    throw new Error('평가를 찾을 수 없습니다.');
  }
  if (snap.data()?.uid !== caller.uid) {
    throw new Error('이 평가에 접근할 권한이 없습니다.');
  }
  return caller;
}
