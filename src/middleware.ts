import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Production 환경에서만 리디렉션을 실행합니다.
  if (process.env.NODE_ENV === 'production') {
    const requestHeaders = new Headers(request.headers);
    const host = requestHeaders.get('host');

    // 여기에 원하는 커스텀 도메인을 입력하세요.
    const customDomain = 'www.speaksmart.com';

    // 기본 Firebase 호스팅 URL 또는 기타 개발용 URL로 접근했을 경우, 커스텀 도메인으로 리디렉션합니다.
    if (host && host !== customDomain && !host.includes('localhost')) {
      const newUrl = new URL(request.url);
      newUrl.host = customDomain;
      return NextResponse.redirect(newUrl.toString(), 301); // 301 영구 리디렉션
    }
  }

  return NextResponse.next();
}

// 이 미들웨어가 실행될 경로를 지정합니다.
// 모든 경로에서 실행되도록 설정합니다.
export const config = {
  matcher: '/:path*',
};
