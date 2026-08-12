'use server';
import { requireTeacher } from '@/lib/auth-guard';

/**
 * @fileOverview 쉐도잉(원어민 음성을 들으며 동시에 따라 읽기) 연습을 평가합니다.
 *
 * 낭독 분석(analyze-read-aloud-flow)과 목적이 다릅니다.
 * 낭독은 '지문을 정확히 읽었는가'를 보지만, 쉐도잉은 그에 더해
 * '원어민의 속도·억양·강세·연음을 얼마나 따라붙었는가'를 봅니다.
 *
 * 출력은 구조화된 값으로 받습니다. 예전에 리포트를 HTML 문자열로 받아
 * 정규식으로 점수를 긁다가 전 항목 0점이 된 적이 있어, 파싱을 두지 않습니다.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { isRetriableAiError, withAudioFallback } from '@/lib/ai-retry';
import { SHADOWING_ANALYSIS_MODEL } from '@/lib/evaluation-models';

const AnalyzeShadowingInputSchema = z.object({
  audioDataUri: z.string().describe("The learner's recorded audio as a data URI."),
  passage: z.string().describe('The English passage the learner was practising.'),
  /** 브라우저 음성 인식이 받아 적은 것. 있으면 참고 자료로 씁니다(없어도 됩니다). */
  liveTranscript: z.string().optional(),
  /** shadowing = 원어민 음성과 동시에 따라 말함. reading = 혼자 소리 내어 읽음. */
  mode: z.enum(['shadowing', 'reading']).default('shadowing'),
  /** 원어민 음성 재생 속도. 느리게 들었다면 감안해서 평가해야 합니다. */
  playbackRate: z.number().optional(),
  model: z.string().optional(),
});
export type AnalyzeShadowingInput = z.infer<typeof AnalyzeShadowingInputSchema>;

const WordIssueSchema = z.object({
  word: z.string().describe('The word from the passage that needs work.'),
  heard: z.string().describe('What the learner actually sounded like. Empty string if the word was skipped.'),
  tip: z.string().describe('One short, concrete correction tip in Korean.'),
});

const AnalyzeShadowingOutputSchema = z.object({
  overallScore: z.number().int().min(0).max(100).describe('Overall shadowing performance.'),
  pronunciationScore: z.number().int().min(0).max(100).describe('Clarity and correctness of individual sounds.'),
  intonationScore: z.number().int().min(0).max(100).describe('Stress, rhythm and sentence melody.'),
  syncScore: z.number().int().min(0).max(100).describe('Shadowing: how steadily the learner held a few-seconds gap behind the model while matching its speed. A constant lag scores high. Reading mode: steadiness of pace instead.'),
  completionRate: z.number().int().min(0).max(100).describe('Percentage of the passage the learner actually attempted.'),
  userTranscript: z.string().describe('What the learner actually said, transcribed from the audio.'),
  strengths: z.string().describe('What the learner did well, in Korean. Two or three sentences.'),
  wordIssues: z.array(WordIssueSchema).describe('Up to 8 words that need the most work. Empty if there is nothing notable.'),
  intonationFeedback: z.string().describe('Feedback on stress, linking and sentence melody, in Korean.'),
  practiceTips: z.string().describe('Concrete next practice steps in Korean.'),
});
export type AnalyzeShadowingOutput = z.infer<typeof AnalyzeShadowingOutputSchema>;

/** 템플릿에서 모드를 분기하려면 불리언이 필요합니다. Handlebars 에는 비교 헬퍼가 없습니다. */
const ShadowingPromptInputSchema = AnalyzeShadowingInputSchema.extend({
  isShadowing: z.boolean(),
});

const shadowingPrompt = ai.definePrompt({
  name: 'shadowingAnalysisPrompt',
  model: SHADOWING_ANALYSIS_MODEL,
  input: { schema: ShadowingPromptInputSchema },
  output: { schema: AnalyzeShadowingOutputSchema },
  prompt: `You are an English shadowing coach. Judge the learner from the AUDIO, not from the transcript.

### Passage the learner was practising
{{{passage}}}

### The learner's recording
{{media url=audioDataUri}}

{{#if liveTranscript}}
### What the browser's speech recogniser picked up
It is often wrong. Treat it only as a hint, and trust the audio when they disagree.
{{{liveTranscript}}}
{{/if}}

### Practice mode
{{#if isShadowing}}
Shadowing — a model voice read the passage{{#if playbackRate}} at {{playbackRate}}x speed{{/if}} and the learner repeated it a few seconds behind.

Shadowing is NOT simultaneous speech. The learner is meant to start about 3 to 4 seconds after the model and then hold that gap while matching the model's speed. So:
- A steady delay of a few seconds is correct technique. Never treat it as hesitation or a mistake.
- syncScore should reward a CONSTANT gap and a matching speaking rate. Lower it only when the learner drifts further and further behind, rushes ahead, or stops to catch up.
- The recording starts when the model starts, so the opening seconds are usually silence while the learner waits. That is expected — do not count it against completionRate or fluency.
- The learner may still be speaking after the model finishes. That tail is normal.
{{else}}
Reading aloud — the learner read on their own, with no model voice. Judge steadiness of pace for syncScore.
{{/if}}

### Rules
1. If the audio is silent or has no discernible speech, set every score to 0, completionRate to 0, leave wordIssues empty, and say so in strengths.
2. completionRate is how much of the passage they attempted, not how well they did it.
3. wordIssues: at most 8, worst first. Only words that are actually in the passage. If the learner skipped a word, set heard to an empty string.
4. Never invent mistakes. If the learner did well, return few or no wordIssues.
5. Write every Korean field in Korean, in a warm and encouraging tone suitable for a school student.`,
});

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetriableAiError(error) || i === retries) throw error;
      console.warn(`[쉐도잉 분석] ${i + 1}번째 시도 실패, ${delay}ms 후 재시도합니다.`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export async function analyzeShadowing(input: AnalyzeShadowingInput): Promise<AnalyzeShadowingOutput> {
  // 서버 액션은 인증 없이 호출될 수 있어 호출자를 먼저 확인합니다.
  await requireTeacher();

  const chosen = input.model || SHADOWING_ANALYSIS_MODEL;

  // 오디오를 넘기므로 모델이 흔들리면 오디오를 확실히 받는 모델로 넘어갑니다.
  const { output } = await withAudioFallback(
    chosen,
    (m) =>
      withRetry(() =>
        shadowingPrompt(
          { ...input, mode: input.mode ?? 'shadowing', isShadowing: input.mode !== 'reading' },
          { model: m }
        )
      ),
    '쉐도잉 분석'
  );

  if (!output) throw new Error('쉐도잉 분석 결과를 받지 못했습니다.');
  return output;
}
