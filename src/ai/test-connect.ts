import { ai } from './genkit';  // ← src/ai/genkit.ts 경로 맞는지 확인

;(async () => {
  const r = await ai.generate({
    prompt: '연결 테스트 – GPT-4o preview',
    model:  'gpt-4o-preview'   // 존재하는 이름으로!
  });
  console.log('✅ 연결 OK:', r.text);
})();
