

'use server';

/**
 * @fileOverview A comprehensive flow that analyzes a student's DIALOGUE English performance.
 * This flow now handles the entire process from analysis to storing the final result in Firestore.
 *
 * - generateDialogueAnalysis - The main function to call for a full dialogue speaking assessment.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import {
  GenerateDialogueAnalysisInputSchema,
  ContentAnalysisOutputSchema,
  PronunciationAnalysisOutputSchema,
  CombinedAnalysisOutputSchema,
  type GenerateDialogueAnalysisInput,
} from '@/lib/types/ai-schemas';
import { evaluationModels, type RubricScores, type StudentResult } from '@/lib/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// This parsing logic is now centralized here.
const parseScore = (text: string, category: string): number => {
    // A more flexible regex that doesn't rely on emojis or exact spacing
    const regex = new RegExp(`${category}[\\s\\S]*?점수[^\\d]*(\\d)`);
    const match = text.match(regex);
    return match ? parseInt(match[1], 10) : 0;
};


// Helper function for retrying API calls on overload
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error.message && (error.message.includes('overloaded') || error.message.includes('503'))) {
        console.warn(`Attempt ${i + 1} failed due to model overload. Retrying in ${delay}ms...`);
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        // Not a retryable error, throw immediately
        throw error;
      }
    }
  }
  throw lastError;
}

/**
 * Main exported function to be called by the client for dialogue analysis.
 */
export async function generateDialogueAnalysis(
    input: GenerateDialogueAnalysisInput
): Promise<void> {
  const resultDocRef = doc(db, "results", input.resultId);

  try {
      console.log(`[Dialogue Flow] Starting analysis for result ID: ${input.resultId}`);
      await updateDoc(resultDocRef, { status: "분석 중: analyze", assessmentType: "dialogue" });
      
      const analysisResult = await generateDialogueAnalysisFlow(input);

      console.log(`[Dialogue Flow] Analysis complete. Updating document with final report for ${input.resultId}`);
      await updateDoc(resultDocRef, { status: "분석 중: report" });
      
      const finalResultData: Partial<StudentResult> = {
          ...analysisResult,
          status: "채점 완료",
          teacherUid: input.teacherUid,
          // Ensure the URL is persisted upon success as well
          studentRecordingUrl: input.studentRecordingUrl,
          assessmentType: "dialogue",
      };
      
      await updateDoc(resultDocRef, finalResultData);
      console.log(`[Dialogue Flow] Final result stored in ${input.resultId}. Status: '채점 완료'`);

  } catch (e: any) {
      console.error(`[Dialogue Flow] An error occurred during dialogue analysis for ${input.resultId}:`, e);
      // On error, still try to save the recording URL for retry purposes.
      await updateDoc(resultDocRef, {
          status: "오류",
          aiFeedback: (e as Error).message || "알 수 없는 오류가 발생했습니다.",
          studentRecordingUrl: input.studentRecordingUrl, // Save URL even on failure
          assessmentType: "dialogue",
      });
      // Re-throw to let the caller know something went wrong.
      throw e;
  }
}

// Internal Sub-prompts
const createPrompt = (modelName: z.infer<typeof evaluationModels[number]>) => ({
    content: ai.definePrompt({
      name: `dialogueContentAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`,
      model: googleAI.model(modelName),
      input: { schema: z.object({
        fullConversationTranscript: z.string(),
        activityPrompt: z.string(),
        expectedFormat: z.string(),
        studentName: z.string(),
        assessmentTitle: z.string(),
      }) },
      output: { schema: ContentAnalysisOutputSchema },
      prompt: `You are an AI English Teacher evaluating a student's DIALOGUE performance based on a full conversation transcript. Your persona is that of an expert English teacher providing constructive feedback for skill improvement. Your entire response must be in the specified JSON format, and all text feedback must be in Korean.

    Here is the context for the evaluation:
    - Student Name: {{{studentName}}}
    - Assessment Title: {{{assessmentTitle}}}
    - Activity Prompt/Situation: {{{activityPrompt}}}
    - Expected Response Format/Grading Criteria: {{{expectedFormat}}}
    - Full Conversation Transcript (Student and AI):
    {{{fullConversationTranscript}}}

    Based on the FULL CONVERSATION, perform the following tasks:
    1.  **Generate Feedback for the Student:** Analyze the student's conversational skills (turn-taking, relevance, naturalness) in addition to fluency, grammar, and vocabulary. Provide encouraging and constructive feedback. Include specific examples from the student's parts of the conversation.
    2.  **Generate Guidance for the Teacher:** Provide actionable advice for the classroom teacher on how to help this student improve their conversational skills.
    3.  **Draft '생활기록부 교과 특기 사항':** Write official school record remarks in a formal, descriptive tone with sentences ending in '~함' or '~임'. The remarks must be based on the student's performance in this specific dialogue, summarizing their interaction and linking it to English communication competencies. Follow a 3-part structure.
    4.  **Assign a Content Score:** Give a score from 0 to 100 for the *content and conversational skill* of the student's performance based on how well they navigated the dialogue in line with the prompt and criteria.
    `,
    }),
    pronunciation: ai.definePrompt({
        name: `dialoguePronunciationAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`,
        model: googleAI.model(modelName),
        input: { schema: z.object({
            studentRecordingUrl: z.string(),
            studentTranscript: z.string(), // Note: This is only the student's part of the transcript
        }) },
        output: { schema: PronunciationAnalysisOutputSchema },
        prompt: `You are an expert English pronunciation coach. Your task is to evaluate a student's spoken English based on their combined audio recording from a conversation and the corresponding transcript of ONLY their speech. Provide all feedback in Korean.

        - Student's Combined Audio Recording: {{media url=studentRecordingUrl}}
        - Transcript of Student's Speech Only: {{{studentTranscript}}}

        Please perform the following steps:
        1.  Listen carefully to the audio and compare it with the student-only transcript.
        2.  Evaluate the student's overall accuracy, clarity, intonation, and fluency throughout the conversation.
        3.  **Assign a Pronunciation Score:** Give a score from 0 to 100 (100 is native-like, 0 is unintelligible).
        4.  **Provide Pronunciation Feedback:** Write specific, constructive feedback in Korean. Point out general patterns or specific words that were pronounced well and those that need improvement. If the transcript is empty or indicates no speech, provide a score of 0 and state that no speech was detected.
        `,
    }),
    rubric: ai.definePrompt({
      name: `dialogueRubricAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`,
      model: googleAI.model(modelName),
      input: { schema: z.object({ fullConversationTranscript: z.string() }) },
      prompt: `### 역할 (Role)
당신은 사용자의 영어 회화 실력을 정확하게 분석하고 피드백을 제공하는 전문 AI 평가관입니다. 당신의 목표는 객관적인 평가 기준에 따라 사용자의 강점과 약점을 진단하고, 실력 향상에 도움이 되는 건설적인 피드백을 제공하는 것입니다.

### 지시사항 (Instructions)
아래에 제공될 **[사용자 발화 내용]**을 분석합니다.

이어지는 **[평가 기준 루브릭]**을 절대적인 기준으로 삼아, 5가지 평가 항목 각각에 대해 1점에서 5점까지의 점수를 부여합니다.

각 항목별로 왜 해당 점수를 부여했는지에 대한 구체적인 근거를 사용자의 발화 내용에서 찾아 제시합니다.

실력 향상을 위한 실질적이고 실행 가능한 조언을 포함한 피드백을 작성합니다.

모든 최종 결과는 반드시 맨 마지막의 **[출력 형식(마크다운)]**에 맞춰 생성해야 합니다.

### [사용자 발화 내용]
{{{fullConversationTranscript}}}

### 평가 기준 루브릭 (Evaluation Rubric)
아래의 평가 기준을 반드시 준수하여 각 항목을 평가하시오. 각 항목은 고유한 평가 기준을 가지며, 점수별 설명에 따라 정확하게 평가해야 합니다.

[평가 항목: 유창성 (Fluency)]
5점 (최상): 원어민과 가까운 속도와 리듬으로 매우 자연스럽게 말함. 의미 전달을 위한 자연스러운 멈춤 외에는 머뭇거림이 거의 없음.
4점 (상): 큰 막힘 없이 안정적인 속도로 말함. 가끔 단어나 표현을 찾기 위해 잠시 멈추지만, 대화의 흐름을 방해하지 않음.
3점 (중): 비교적 이해 가능한 속도로 말하지만, 단어나 문법을 생각하느라 머뭇거리거나 부자연스러운 멈춤이 눈에 띔.
2점 (하): 매우 느리고 자주 끊어지며 말함. 긴 문장을 만드는 데 어려움을 겪고, 대화를 이어가기 힘듦.
1점 (최하): 단어 단위로 말하거나, 외워 둔 극히 짧은 문장만 구사 가능.

[평가 항목: 발음 및 억양 (Pronunciation & Intonation)]
5점 (최상): 발음이 매우 명확하고, 문장의 의미에 맞게 자연스러운 억양과 강세를 사용함. 원어민이 듣기에 전혀 무리가 없음.
4점 (상): 대부분의 발음이 정확하여 쉽게 이해할 수 있음. 약간의 모국어 억양이 남아있지만, 의사소통에 거의 영향을 주지 않음.
3점 (중): 일부 단어의 발음이 부정확하여 가끔 재확인이 필요함. 억양이 단조롭거나 부자연스러워 의미 전달이 제한될 수 있음.
2점 (하): 부정확한 발음이 많아 듣는 사람이 이해하기 위해 상당한 노력을 기울여야 함.
1점 (최하): 발음을 거의 이해할 수 없어 의사소통이 매우 어려움.

[평가 항목: 문법 (Grammar)]
5점 (최상): 복잡한 문장 구조를 포함하여 다양한 문법을 거의 실수 없이 정확하게 사용함.
4점 (상): 일상적인 문법 구조를 대부분 정확하게 사용함. 복잡한 문장에서 가끔 실수가 보이지만, 의미를 해치지는 않음.
3점 (중): 기본적인 문장 구조는 사용하나, 시제, 수일치, 전치사 등에서 반복적인 실수가 나타남.
2점 (하): 문법 지식이 매우 제한적이며, 기본적인 문장 구성에도 오류가 많아 의미가 왜곡되는 경우가 잦음.
1점 (최하): 문장을 거의 구성하지 못함.

[평가 항목: 어휘 (Vocabulary)]
5점 (최상): 주제에 맞게 폭넓고 수준 높은 어휘를 정확하게 사용함. 관용적인 표현도 적절히 활용함.
4점 (상): 주제에 대해 논의하기에 충분한 어휘를 구사하며, 모르는 단어는 다른 표현으로 설명할 수 있음.
3점 (중): 일상적이고 기본적인 어휘는 구사하나, 어휘의 폭이 좁아 반복적인 단어를 사용하거나 부적절한 단어를 선택하는 경우가 있음.
2점 (하): 매우 제한적인 어휘만 알고 있어 표현에 한계가 명확함. 단어를 찾느라 대화가 자주 끊김.
1점 (최하): 극소수의 기본 단어만 알고 있음.

[평가 항목: 내용 이해 및 상호작용 (Comprehension & Interaction)]
5점 (최상): 미묘한 뉘앙스나 유머까지 포함하여 상대방의 말을 완벽하게 이해함. 대화의 흐름을 주도하고, 적극적으로 질문하며 깊이 있는 상호작용을 함.
4점 (상): 대부분의 말을 어려움 없이 이해하고 대화 주제에 맞게 적절히 반응함. 대화를 이어가기 위한 질문을 할 수 있음.
3점 (중): 간단하고 천천히 말하는 문장은 이해하나, 길거나 빠른 문장은 이해에 어려움을 겪고 되묻는 경우가 잦음. 수동적으로 답변하는 경향이 있음.
2점 (하): 아주 간단한 질문만 이해하고, 대화에 거의 참여하지 못함. 동문서답을 하거나 반응이 없는 경우가 많음.
1점 (최하): 상대방의 말을 거의 이해하지 못하여 상호작용이 불가능함.

### 출력 형식 (Output Format)
[중요] 아래의 마크다운 구조와 스타일을 반드시 준수하여 리포트 형식으로 결과를 생성해 주세요.

# 📝 영어 회화 능력 종합 분석 리포트

## 💬 총평 (Overall Comment)
[사용자의 전반적인 회화 능력에 대한 총평과 격려의 메시지를 1~2문장으로 작성해 주세요.]

## 📊 종합 점수 (Overall Score)
**[평가한 5개 항목의 점수 평균을 100점 만점으로 환산한 최종 점수를 "최종 점수는 100점 만점에 00점입니다." 형식으로 여기에 표시해 주세요. 예를 들어, 5개 항목 평균이 4점이면 80점입니다.]**

## 📊 항목별 상세 분석 (Detailed Analysis)

### 🗣️ 유창성 (Fluency) - 📈 점수: [점수]/5점
| 👍 잘한 점 (Strengths) | 💡 개선점 (Areas for Improvement) |
| --- | --- |
| [사용자의 발화 내용 중 유창성 측면에서 잘한 점을 구체적인 예시를 들어 칭찬해 주세요. 목록 형식(-)으로 작성하세요.] | [유창성을 저해하는 요소(예: 잦은 멈춤, 필러 사용)를 지적하고, 개선을 위한 실질적인 조언 1~2가지를 목록 형식(-)으로 제안해 주세요.] |

### 🎤 발음 및 억양 (Pronunciation & Intonation) - 📈 점수: [점수]/5점
| 👍 잘한 점 (Strengths) | 💡 개선점 (Areas for Improvement) |
| --- | --- |
| [전반적으로 발음이 명확했거나 특정 단어의 발음이 좋았던 점을 목록 형식(-)으로 칭찬해 주세요.] | [부정확했던 발음의 예시('단어'의 발음이 '발음'으로 들렸습니다)를 제시하고, 자연스러운 억양 연습 방법을 목록 형식(-)으로 제안해 주세요.] |

### ✍️ 문법 (Grammar) - 📈 점수: [점수]/5점
| 👍 잘한 점 (Strengths) | 💡 개선점 (Areas for Improvement) |
| --- | --- |
| [정확하게 사용한 문법 구조(예: 과거 시제, 관계대명사)를 목록 형식(-)으로 칭찬해 주세요.] | [반복적으로 틀린 문법(예: 수일치 오류, 잘못된 전치사 사용)을 지적하고, 올바른 문장 예시와 함께 수정안을 목록 형식(-)으로 제시해 주세요.] |

### 📚 어휘 (Vocabulary) - 📈 점수: [점수]/5점
| 👍 잘한 점 (Strengths) | 💡 개선점 (Areas for Improvement) |
| --- | --- |
| [주제에 맞게 적절히 사용한 좋은 단어나 표현이 있다면 목록 형식(-)으로 칭찬해 주세요.] | [어휘의 폭을 넓히기 위해, 사용자가 쓴 단어를 대체할 수 있는 더 나은 동의어나 관련 표현을 2~3개 목록 형식(-)으로 추천해 주세요.] |

### 🤝 내용 이해 및 상호작용 (Comprehension & Interaction) - 📈 점수: [점수]/5점
| 👍 잘한 점 (Strengths) | 💡 개선점 (Areas for Improvement) |
| --- | --- |
| [AI의 질문이나 대화 상대의 말을 잘 이해하고 적절하게 답변한 부분을 목록 형식(-)으로 칭찬해 주세요.] | [사용자가 질문의 요지를 파악하지 못했거나 동문서답했다면 그 부분을 목록 형식(-)으로 지적해 주세요.] |
`,
    }),
});

// The Main Orchestration Flow for Dialogue
const generateDialogueAnalysisFlow = ai.defineFlow(
  {
    name: 'generateDialogueAnalysisFlow',
    inputSchema: GenerateDialogueAnalysisInputSchema.pick({
      studentRecordingUrl: true,
      studentTranscript: true,
      fullConversationTranscript: true,
      activityPrompt: true,
      expectedFormat: true,
      studentName: true,
      assessmentTitle: true,
      evaluationModel: true,
      useRubric: true,
    }),
    outputSchema: CombinedAnalysisOutputSchema,
  },
  async (input) => {
    const model = input.evaluationModel || 'gemini-2.5-flash';
    const prompts = createPrompt(model);
    
    // In this flow, transcription is already done. We receive the transcript and audio URL.
    if (!input.studentTranscript || !input.fullConversationTranscript) {
        return {
            studentTranscript: input.fullConversationTranscript || '전체 대화 기록이 없습니다.',
            aiFeedback: '학생의 답변이 없어 분석을 진행할 수 없습니다.',
            teacherGuidance: '학생의 답변이 없어 조언을 생성할 수 없습니다.',
            curricularRemarks: '학생의 답변이 없어 비고 작성이 불가능합니다.',
            contentScore: 0,
            pronunciationScore: 0,
            pronunciationFeedback: '학생의 음성이 없어 발음 분석을 할 수 없습니다.',
            rubricScores: { fluency: 0, pronunciation: 0, grammar: 0, vocabulary: 0, interaction: 0 },
        }
    }
    
    if (input.useRubric) {
        const rubricResult = await withRetry(() => prompts.rubric({ fullConversationTranscript: input.fullConversationTranscript }));
        const rubricText = rubricResult.text;
        
        const rubricScores: RubricScores = {
            fluency: parseScore(rubricText, '유창성'),
            pronunciation: parseScore(rubricText, '발음 및 억양'),
            grammar: parseScore(rubricText, '문법'),
            vocabulary: parseScore(rubricText, '어휘'),
            interaction: parseScore(rubricText, '내용 이해 및 상호작용'),
        };

        const contentScore = Math.round(((rubricScores.fluency + rubricScores.grammar + rubricScores.vocabulary + (rubricScores.interaction || 0)) / 4) * 20);
        const pronunciationScore = rubricScores.pronunciation * 20;

        return {
            studentTranscript: input.fullConversationTranscript,
            contentScore: contentScore,
            pronunciationScore: pronunciationScore,
            aiFeedback: rubricText,
            teacherGuidance: "루브릭 기반 평가를 사용했습니다. 학생의 강점과 약점을 항목별로 확인하고, 개선점에 제시된 활동을 지도해주세요.",
            curricularRemarks: `'${input.assessmentTitle}' 대화형 평가에서 루브릭 기반으로 종합 ${contentScore}점, 발음 ${pronunciationScore}점을 받는 등 준수한 성취를 보임. 특히 상호작용(${rubricScores.interaction! * 20}점) 능력이 돋보임.`,
            pronunciationFeedback: `루브릭 기반 발음 점수는 ${pronunciationScore}점입니다. 상세 내용은 종합 분석 리포트를 참고하세요.`,
            rubricScores,
        };
    }

    // Step 1: Run content and pronunciation analysis in PARALLEL with retry logic.
    const [contentResult, pronunciationResult] = await Promise.all([
      withRetry(() => prompts.content({
        fullConversationTranscript: input.fullConversationTranscript,
        activityPrompt: input.activityPrompt,
        expectedFormat: input.expectedFormat,
        studentName: input.studentName,
        assessmentTitle: input.assessmentTitle,
      })),
      withRetry(() => prompts.pronunciation({
        studentRecordingUrl: input.studentRecordingUrl,
        studentTranscript: input.studentTranscript, // Use student-only transcript for pronunciation
      }))
    ]);

    const contentOutput = contentResult.output;
    const pronunciationOutput = pronunciationResult.output;

    if (!contentOutput || !pronunciationOutput) {
        throw new Error("Failed to get a valid response from one or more analysis models.");
    }
    
    // Step 2: Combine and return all results to the client.
    return {
        // Return the full conversation transcript for display purposes
        studentTranscript: input.fullConversationTranscript, 
        contentScore: contentOutput.contentScore,
        aiFeedback: contentOutput.aiFeedback,
        teacherGuidance: contentOutput.teacherGuidance,
        curricularRemarks: contentOutput.curricularRemarks,
        pronunciationScore: pronunciationOutput.pronunciationScore,
        pronunciationFeedback: pronunciationOutput.pronunciationFeedback,
    };
  }
);
