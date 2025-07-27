
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
        prompt: `You are an HTML generation machine. Your ONLY task is to create a complete, single HTML file for a web-based report based on the user's speech and the provided rubric.

IMPORTANT INSTRUCTION: Your output MUST be ONLY the HTML code, starting with <!DOCTYPE html> and ending with </html>. Do NOT include any other text, explanations, or markdown code blocks (like \`\`\`html) before or after the HTML content.

[사용자 발화 내용]
{{{fullConversationTranscript}}}

### HTML Generation Requirements:

#### 1. Content Structure:
-   **Main Title:** Use an <h1> tag for "📊 AI 영어회화 상세 분석".
-   **Category Cards:** Create a <div class="category-card"> for each of the 5 analysis categories:
    -   🗣️ 유창성 (Fluency)
    -   🎤 발음 및 억양 (Pronunciation & Intonation)
    -   ✍️ 문법 (Grammar)
    -   📚 어휘 (Vocabulary)
    -   🤝 내용 이해 및 상호작용 (Comprehension & Interaction)
-   **Card Header:** Inside each card, use an <h2> for the category title and a <span> with class="score-display" for the score (e.g., "📈 점수: 4 / 5점").
-   **Card Details:** Inside each card, below the header, create a <div class="detail-flex-container">. Inside this container, create two boxes:
    -   <div class="detail-box good-points"> for "👍 잘한 점".
    -   <div class="detail-box improvement-points"> for "💡 개선점".
-   **Box Content:** Each "detail-box" must have an <h3> for its title and a <ul> with <li> elements for the detailed feedback points.

#### 2. Design & Style (MUST be inside a <style> tag in the <head>):
-   **Layout:**
    -   Use Flexbox to arrange "잘한 점" and "개선점" boxes side-by-side (\`.detail-flex-container { display: flex; }\`).
    -   Center the main content on the page with \`max-width: 900px\` and \`margin: auto;\`.
-   **Responsiveness (MANDATORY):**
    -   Use a media query (\`@media (max-width: 768px)\`) to stack the "잘한 점" and "개선점" boxes vertically (\`flex-direction: column;\`).
-   **Colors & Effects:**
    -   Page background: \`#f4f7f9\`.
    -   Card background: \`#ffffff\`.
    -   "잘한 점" box: \`background-color: #e8f5e9;\`, \`border-left: 5px solid #4caf50;\`.
    -   "개선점" box: \`background-color: #fff3e0;\`, \`border-left: 5px solid #ff9800;\`.
    -   Add a \`box-shadow\` and \`transform: translateY(-5px);\` effect on \`.category-card:hover\`.
-   **Font:**
    -   Set \`font-family\` to a standard sans-serif stack like \`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\`.
-   **Technical Requirement:**
    -   Do NOT use any external CSS libraries. All styles must be inline in the \`<style>\` tag.
    -   Include comments in the CSS to explain style blocks.

### 평가 기준 루브릭 (Evaluation Rubric)
아래의 평가 기준을 반드시 준수하여 각 항목을 평가하시오. 각 항목은 고유한 평가 기준을 가지며, 점수별 설명에 따라 정확하게 평가해야 합니다.

[평가 항목: 유창성 (Fluency)]
5점 (최상): 원어민과 가까운 속도와 리듬으로 매우 자연스럽게 말함.
4점 (상): 큰 막힘 없이 안정적인 속도로 말함.
3점 (중): 비교적 이해 가능한 속도로 말하지만, 머뭇거림이 눈에 띔.
2점 (하): 매우 느리고 자주 끊어지며 말함.
1점 (최하): 단어 단위로 말함.

[평가 항목: 발음 및 억양 (Pronunciation & Intonation)]
5점 (최상): 발음이 매우 명확하고 자연스러운 억양을 사용함.
4점 (상): 대부분의 발음이 정확하여 쉽게 이해할 수 있음.
3점 (중): 일부 단어의 발음이 부정확하여 가끔 재확인이 필요함.
2점 (하): 부정확한 발음이 많아 이해하기 위해 노력이 필요함.
1점 (최하): 발음을 거의 이해할 수 없음.

[평가 항목: 문법 (Grammar)]
5점 (최상): 복잡한 문장 구조를 포함하여 다양한 문법을 거의 실수 없이 사용함.
4점 (상): 일상적인 문법 구조를 대부분 정확하게 사용함.
3점 (중): 기본적인 문장 구조는 사용하나, 반복적인 실수가 나타남.
2점 (하): 기본적인 문장 구성에도 오류가 많음.
1점 (최하): 문장을 거의 구성하지 못함.

[평가 항목: 어휘 (Vocabulary)]
5점 (최상): 주제에 맞게 폭넓고 수준 높은 어휘를 정확하게 사용함.
4점 (상): 주제에 대해 논의하기에 충분한 어휘를 구사함.
3점 (중): 기본적인 어휘는 구사하나, 어휘의 폭이 좁아 반복적인 단어를 사용함.
2점 (하): 매우 제한적인 어휘만 알고 있음.
1점 (최하): 극소수의 기본 단어만 알고 있음.

[평가 항목: 내용 이해 및 상호작용 (Comprehension & Interaction)]
5점 (최상): 상대방의 말을 완벽하게 이해하고 대화의 흐름을 주도함.
4점 (상): 대부분의 말을 어려움 없이 이해하고 적절히 반응함.
3점 (중): 간단한 문장은 이해하나, 길거나 빠른 문장은 이해에 어려움을 겪음.
2점 (하): 아주 간단한 질문만 이해하고, 대화에 거의 참여하지 못함.
1점 (최하): 상대방의 말을 거의 이해하지 못함.

Now, generate the HTML code.
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
        let rubricText = rubricResult.text;
         // Clean up the text just in case the model still wraps it
        if (rubricText.startsWith("```html")) {
            rubricText = rubricText.substring(7, rubricText.length - 3).trim();
        }
        
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
