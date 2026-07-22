'use server';

export async function getLiveSessionToken(): Promise<string> {
    const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
        throw new Error("API Key configuration error on server");
    }
    return key;
}
