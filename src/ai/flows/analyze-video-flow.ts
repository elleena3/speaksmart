// src/ai/flows/analyze-video-flow.ts
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

/* ---------- 1. 입·출력 스키마 ---------- */
const Input = z.object({
  /** Firestore에 저장된 객체 경로 예: misc-uploads/uid/1700_video.webm */
  filePath : z.string(),
  /** video/mp4, video/webm 등 */
  mimeType : z.string(),
  /** “영상 속 인물의 감정 변화를 시간순으로 설명해줘” */
  prompt   : z.string(),
});
type AnalyzeVideoInput = z.infer<typeof Input>;

const Output = z.object({ analysis: z.string() });
type AnalyzeVideoOutput = z.infer<typeof Output>;

/* ---------- 2. 퍼블릭 함수 ---------- */
export async function analyzeVideo(
  input: AnalyzeVideoInput,
): Promise<AnalyzeVideoOutput> {
  return analyzeVideoFlow(input);
}

/* ---------- 3. Genkit Flow 본체 ---------- */
const analyzeVideoFlow = ai.defineFlow(
  { name: 'analyzeVideoFlow', inputSchema: Input, outputSchema: Output },
  async ({ filePath, mimeType, prompt }) => {
    /* 3‑1) 버킷 이름 확인 */
    const bucket = process.env.GCS_BUCKET_NAME;              // 예: speaksmart-evaluator2.appspot.com
    if (!bucket) throw new Error('GCS_BUCKET_NAME env 가 비어 있습니다.');

    /* 3‑2) 객체 경로 인코딩 & URI 생성 */
    const encodedPath = encodeURI(filePath.replace(/^\/+/, '')); // 선행 슬래시 제거 후 encodeURI
    const fileUri     = `gs://${bucket}/${encodedPath}`;

    console.log('Gemini 요청 URI →', fileUri);

    /* 3‑3) 모델 호출 */
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const res = await model.generateContent({
      contents: [{
        role : 'user',
        parts: [
          { fileData: { fileUri, mimeType } },  // ✅ CamelCase 필드
          { text: prompt },
        ],
      }],
    });

    const analysis = res.response.text?.();
    if (!analysis) throw new Error('분석 결과가 비어 있습니다.');
    return { analysis };
  },
);