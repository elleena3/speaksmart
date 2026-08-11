'use server';
import { requireUser } from '@/lib/auth-guard';

export async function getLiveSessionToken(): Promise<string> {
    // 이 함수는 API 키 원본을 돌려줍니다. 로그인한 사용자에게만 내어 줍니다.
    // (그래도 키가 브라우저에 남는 문제는 남습니다 — OPERATION_GUIDE 참고)
    await requireUser();
    const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
        throw new Error("API Key configuration error on server");
    }
    return key;
}
