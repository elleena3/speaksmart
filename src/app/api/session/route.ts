/**
 * @fileOverview 로그인 세션 쿠키 발급·폐기.
 *
 * 서버 액션은 누구나 호출할 수 있는 HTTP 엔드포인트입니다.
 * 클라이언트가 매 호출마다 ID 토큰을 인자로 넘기게 하면 액션 서명과 호출부를
 * 전부 고쳐야 하고, 새로 추가되는 액션에서 빠뜨리기도 쉽습니다.
 *
 * 대신 로그인할 때 httpOnly 세션 쿠키를 한 번 발급해 두고,
 * 서버 액션은 src/lib/auth-guard.ts 의 가드로 그 쿠키를 확인합니다.
 * 쿠키는 브라우저가 자동으로 실어 보내므로 호출부는 손대지 않아도 됩니다.
 */

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/** Firebase 세션 쿠키의 최대 수명은 14일입니다. */
const SESSION_DAYS = 5;
const EXPIRES_IN_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

// 라우트 핸들러 파일은 GET/POST 같은 정해진 것만 export 할 수 있습니다.
// 상수를 함께 내보내면 타입 검사가 실패하므로 여기서는 지역 상수로 둡니다.
// 같은 이름을 src/lib/auth-guard.ts 가 따로 갖고 있습니다.
const SESSION_COOKIE_NAME = 'speaksmart_session';

/** ID 토큰을 세션 쿠키로 바꿔 심습니다. */
export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken) {
      return NextResponse.json({ error: 'idToken 이 없습니다.' }, { status: 400 });
    }

    // 토큰이 유효한지 먼저 확인합니다. 여기서 걸러야 잘못된 쿠키가 남지 않습니다.
    await getAdminAuth().verifyIdToken(idToken);

    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: EXPIRES_IN_MS,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionCookie,
      maxAge: EXPIRES_IN_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('세션 쿠키 발급 실패:', error);
    return NextResponse.json({ error: '세션을 만들지 못했습니다.' }, { status: 401 });
  }
}

/** 로그아웃 시 쿠키를 지웁니다. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
