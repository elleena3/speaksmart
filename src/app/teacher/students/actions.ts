'use server';

/**
 * @fileOverview 교사 전용 계정 관리 서버 액션.
 *
 * 다른 사용자의 비밀번호를 바꾸거나 계정을 삭제하는 일은 클라이언트 SDK로는 불가능하므로
 * Admin SDK를 사용합니다. 서버 액션은 누구나 호출할 수 있는 HTTP 엔드포인트이기 때문에,
 * 호출자의 Firebase ID 토큰을 검증하고 교사 역할인지 반드시 확인합니다.
 *
 * 사전 조건: 환경 변수 FIREBASE_SERVICE_ACCOUNT_KEY 설정
 * (설정 방법은 src/lib/firebase-admin.ts 상단 주석 참고)
 */

import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

/** ID 토큰을 검증하고 호출자가 교사인지 확인한 뒤 교사 UID를 반환합니다. */
async function requireTeacher(idToken: string): Promise<string> {
  if (!idToken) {
    throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
  }

  const decoded = await getAdminAuth().verifyIdToken(idToken);
  const callerSnap = await getAdminDb().collection('users').doc(decoded.uid).get();

  if (!callerSnap.exists || callerSnap.data()?.role !== 'teacher') {
    throw new Error('교사 계정만 수행할 수 있는 작업입니다.');
  }

  return decoded.uid;
}

/** 대상 UID가 실제로 학생 문서인지 확인합니다. 교사 계정을 실수로 건드리는 것을 막습니다. */
async function requireStudent(studentUid: string): Promise<void> {
  const snap = await getAdminDb().collection('users').doc(studentUid).get();
  if (!snap.exists || snap.data()?.role !== 'student') {
    throw new Error('학생 계정을 찾을 수 없습니다.');
  }
}

export type AdminActionResult = { success: boolean; message: string };

/** 학생 비밀번호를 지정한 값으로 재설정합니다. */
export async function resetStudentPassword(
  idToken: string,
  studentUid: string,
  newPassword: string
): Promise<AdminActionResult> {
  try {
    await requireTeacher(idToken);
    await requireStudent(studentUid);

    if (newPassword.length < 6) {
      return { success: false, message: '비밀번호는 6자리 이상이어야 합니다.' };
    }

    await getAdminAuth().updateUser(studentUid, { password: newPassword });
    return { success: true, message: '비밀번호가 초기화되었습니다.' };
  } catch (error) {
    console.error('resetStudentPassword 실패:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '비밀번호 초기화에 실패했습니다.',
    };
  }
}

/**
 * 학생의 Firebase Auth 계정을 삭제합니다.
 * Firestore의 users/results 문서 삭제는 호출하는 화면에서 처리합니다.
 */
export async function deleteStudentAuthAccount(
  idToken: string,
  studentUid: string
): Promise<AdminActionResult> {
  try {
    await requireTeacher(idToken);
    await requireStudent(studentUid);

    await getAdminAuth().deleteUser(studentUid);
    return { success: true, message: '계정이 삭제되었습니다.' };
  } catch (error) {
    console.error('deleteStudentAuthAccount 실패:', error);

    // Auth 계정이 이미 없는 경우는 실패로 보지 않습니다.
    // Firestore 문서만 남아 있는 상태를 정리할 수 있어야 하기 때문입니다.
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'auth/user-not-found') {
      return { success: true, message: 'Auth 계정이 이미 없어 Firestore 문서만 정리합니다.' };
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : '계정 삭제에 실패했습니다.',
    };
  }
}
