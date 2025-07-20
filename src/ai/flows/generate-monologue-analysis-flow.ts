
'use server';

/**
 * @fileOverview A comprehensive flow that analyzes a student's MONOLOGUE English performance.
 * It orchestrates transcription, content analysis, and pronunciation analysis in an efficient, parallel manner.
 *
 * - processAndAnalyzeMonologue - The main function to call for a full monologue speaking assessment.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import {
  ContentAnalysisOutputSchema,
  PronunciationAnalysisOutputSchema,
  CombinedAnalysisOutputSchema,
} from '@/lib/types/ai-schemas';
import { evaluationModels, type RubricScores } from '@/lib/types';
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc } from 'firebase/firestore';


// Input schema for the new, consolidated flow
const MonologueProcessingInputSchema = z.object({
  studentRecordingDataUri: z.string().describe(
    "The student's voice recording as a data URI."
  ),
  activityPrompt: z.string().describe('The prompt or instructions for the speaking activity.'),
  expectedFormat: z.string().describe('The expected format or key points of the response for grading.'),
  studentName: z.string().describe('The name of the student.'),
  assessmentTitle: z.string().describe('The title of the assessment.'),
  evaluationModel: z.enum(evaluationModels).optional(),
  useRubric: z.boolean().optional().describe('Whether to use the standardized rubric for evaluation.'),
  resultId: z.string().describe('The Firestore document ID for the result to update progress.'),
});
type MonologueProcessingInput = z.infer<typeof MonologueProcessingInputSchema>;


// Main exported function to be called by the client
export async function processAndAnalyzeMonologue(
    input: MonologueProcessingInput
): Promise<z.infer<typeof CombinedAnalysisOutputSchema>> {
  return generateMonologueAnalysisFlow(input);
}


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

// Internal Sub-prompts
const createPrompt = (modelName: z.infer<typeof evaluationModels[number]>) => ({
    transcription: ai.definePrompt({
        name: `transcribeAudioPrompt_${modelName.replace(/[-.]/g, '_')}`,
        model: googleAI.model(modelName),
        input: { schema: z.object({ studentRecordingUrl: z.string() }) },
        prompt: `Transcribe this English audio.
    Audio: {{media url=studentRecordingUrl}}
    `,
    }),
    content: ai.definePrompt({
      name: `monologueContentAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`,
      model: googleAI.model(modelName),
      input: { schema: z.object({
        studentTranscript: z.string(),
        activityPrompt: z.string(),
        expectedFormat: z.string(),
        studentName: z.string(),
        assessmentTitle: z.string(),
      }) },
      output: { schema: ContentAnalysisOutputSchema },
      prompt: `You are an AI English Teacher evaluating a student's monologue performance based on a transcript. Your persona is that of an expert English teacher providing constructive feedback for skill improvement. Your entire response must be in the specified JSON format, and all text feedback must be in Korean.
    
    Here is the context for the evaluation:
    - Student Name: {{{studentName}}}
    - Assessment Title: {{{assessmentTitle}}}
    - Activity Prompt: {{{activityPrompt}}}
    - Expected Response Format/Grading Criteria: {{{expectedFormat}}}
    - Student's Spoken Response (Transcript): {{{studentTranscript}}}
    
    Based on all the information provided, perform the following tasks:
    1.  **Generate Feedback for the Student:** Write encouraging and constructive feedback focusing on what they did well and what they can improve regarding fluency, grammar, and vocabulary in relation to the prompt. Include specific examples from their transcript. Suggest alternative English vocabulary or sentence structures.
    2.  **Generate Guidance for the Teacher:** Provide actionable advice for the classroom teacher on how to help this student. Suggest specific English teaching activities or focus areas.
    3.  **Draft Curricular Remarks:** Write official curricular remarks in a formal, descriptive tone with sentences ending in '~함' or '~임'. The remarks must be based on the student's performance in this specific task, summarizing their performance and linking it to English competencies. Follow a 3-part structure: ① General participation, ② Specific examples from their speech, ③ Collaboration/other character traits.
    4.  **Assign a Content Score:** Give a score from 0 to 100 for the *content* of the response based on how well it aligns with the prompt and criteria.
    `,
    }),
    pronunciation: ai.definePrompt({
        name: `monologuePronunciationAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`,
        model: googleAI.model(modelName),
        input: { schema: z.object({
            studentRecordingUrl: z.string(),
            studentTranscript: z.string(),
        }) },
        output: { schema: PronunciationAnalysisOutputSchema },
        prompt: `You are an expert English pronunciation coach. Your task is to evaluate a student's spoken English based on their audio recording and the corresponding transcript. Provide all feedback in Korean.
    
    - Student's Audio Recording: {{media url=studentRecordingUrl}}
    - AI-generated Transcript: {{{studentTranscript}}}
    
    Please perform the following steps:
    1.  Listen carefully to the audio and compare it with the transcript.
    2.  Evaluate accuracy, clarity, intonation, and fluency.
    3.  **Assign a Pronunciation Score:** Give a score from 0 to 100 (100 is native-like, 0 is unintelligible).
    4.  **Provide Pronunciation Feedback:** Write specific, constructive feedback in Korean. Point out specific words or sounds that were pronounced well and those that need improvement. If the transcript is empty or indicates no speech, provide a score of 0 and state that no speech was detected.
    `,
    }),
    rubric: ai.definePrompt({
      name: `monologueRubricAnalysisPrompt_${modelName.replace(/[-.]/g, '_')}`,
      model: googleAI.model(modelName),
      input: { schema: z.object({ studentTranscript: z.string() }) },
      prompt: `### 역할 (Role)
당신은 사용자의 영어 회화 실력을 정확하게 분석하고 피드백을 제공하는 전문 AI 평가관입니다. 당신의 목표는 객관적인 평가 기준에 따라 사용자의 강점과 약점을 진단하고, 실력 향상에 도움이 되는 건설적인 피드백을 제공하는 것입니다.

### 지시사항 (Instructions)
아래에 제공될 **[사용자 발화 내용]**을 분석합니다.

이어지는 **[평가 기준 루브릭]**을 절대적인 기준으로 삼아, 4가지 평가 항목(유창성, 발음, 문법, 어휘) 각각에 대해 1점에서 5점까지의 점수를 부여합니다. '내용 이해 및 상호작용' 항목은 1점으로 고정합니다.

각 항목별로 왜 해당 점수를 부여했는지에 대한 구체적인 근거를 사용자의 발화 내용에서 찾아 제시합니다.

실력 향상을 위한 실질적이고 실행 가능한 조언을 포함한 피드백을 작성합니다.

모든 최종 결과는 반드시 맨 마지막의 **[출력 형식(마크다운)]**에 맞춰 생성해야 합니다.

### [사용자 발화 내용]
{{{studentTranscript}}}

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
이 항목은 대화형 시나리오에서만 평가합니다. 혼자 말하기 과제였으므로 이 항목은 1점으로 고정하고, 피드백은 '평가 대상 아님'으로 작성합니다.

### 출력 형식
[중요] 아래의 마크다운 구조와 스타일을 반드시 준수하여 리포트 형식으로 결과를 생성해 주세요.

# 📝 영어 회화 능력 종합 분석 리포트

## 💬 총평 (Overall Comment)
[사용자의 전반적인 회화 능력에 대한 총평과 격려의 메시지를 1~2문장으로 작성해 주세요.]

## 📊 종합 점수 (Overall Score)
**[평가한 4개 항목(유창성, 발음, 문법, 어휘)의 점수 평균을 100점 만점으로 환산한 최종 점수를 "최종 점수는 100점 만점에 00점입니다." 형식으로 여기에 표시해 주세요. 예를 들어, 4개 항목 평균이 3점이면 60점입니다.]**

## 📊 항목별 상세 분석 (Detailed Analysis)

### 🗣️ 유창성 (Fluency)
**- 📈 점수:** [점수] / 5점
**- 👍 잘한 점:**
    - [사용자의 발화 내용 중 유창성 측면에서 잘한 점을 구체적인 예시를 들어 칭찬해 주세요.]
**- 💡 개선점:**
    - [유창성을 저해하는 요소(예: 잦은 멈춤, 필러 사용)를 지적하고, 개선을 위한 실질적인 조언 1~2가지를 제안해 주세요.]

### 🎤 발음 및 억양 (Pronunciation & Intonation)
**- 📈 점수:** [점수] / 5점
**- 👍 잘한 점:**
    - [전반적으로 발음이 명확했거나 특정 단어의 발음이 좋았던 점을 칭찬해 주세요.]
**- 💡 개선점:**
    - [부정확했던 발음의 예시('단어'의 발음이 '발음'으로 들렸습니다)를 제시하고, 자연스러운 억양 연습 방법을 제안해 주세요.]

### ✍️ 문법 (Grammar)
**- 📈 점수:** [점수] / 5점
**- 👍 잘한 점:**
    - [정확하게 사용한 문법 구조(예: 과거 시제, 관계대명사)를 칭찬해 주세요.]
**- 💡 개선점:**
    - [반복적으로 틀린 문법(예: 수일치 오류, 잘못된 전치사 사용)을 지적하고, 올바른 문장 예시와 함께 수정안을 제시해 주세요.]

### 📚 어휘 (Vocabulary)
**- 📈 점수:** [점수] / 5점
**- 👍 잘한 점:**
    - [주제에 맞게 적절히 사용한 좋은 단어나 표현이 있다면 칭찬해 주세요.]
**- 💡 개선점:**
    - [어휘의 폭을 넓히기 위해, 사용자가 쓴 단어를 대체할 수 있는 더 나은 동의어나 관련 표현을 2~3개 추천해 주세요.]

### 🤝 내용 이해 및 상호작용 (Comprehension & Interaction)
**- 📈 점수:** 1 / 5점
**- 👍 잘한 점:**
    - [이 항목은 대화형 시나리오에서만 평가합니다. 혼자 말하기 과제였으므로 이 항목은 평가 대상이 아닙니다.]
**- 💡 개선점:**
    - [이 항목은 대화형 시나리오에서만 평가합니다. 혼자 말하기 과제였으므로 이 항목은 평가 대상이 아닙니다.]
`,
    }),
});


// The Main Orchestration Flow
const generateMonologueAnalysisFlow = ai.defineFlow(
  {
    name: 'generateMonologueAnalysisFlow',
    inputSchema: MonologueProcessingInputSchema,
    outputSchema: CombinedAnalysisOutputSchema,
  },
  async (input) => {
    const model = input.evaluationModel || 'gemini-2.5-flash';
    const prompts = createPrompt(model);
    const resultDocRef = doc(db, "results", input.resultId);

    // Step 1: Transcribe the audio
    await updateDoc(resultDocRef, { status: "분석 중: transcribe" });
    const transcriptionResult = await withRetry(() => prompts.transcription({ studentRecordingUrl: input.studentRecordingDataUri }));
    const studentTranscript = transcriptionResult.text;

    if (!studentTranscript || studentTranscript.trim() === "" || studentTranscript.includes('기록되지 않았습니다') || studentTranscript.includes('인식하지 못했습니다')) {
        return {
            studentTranscript: studentTranscript || '학생 답변을 인식하지 못했습니다.',
            aiFeedback: '학생의 답변을 인식하지 못했습니다. 마이크 상태를 확인하고 다시 시도해주세요.',
            teacherGuidance: '학생의 답변을 인식할 수 없어 조언을 생성할 수 없습니다.',
            curricularRemarks: '학생의 답변이 없어 비고 작성이 불가능합니다.',
            contentScore: 0,
            pronunciationScore: 0,
            pronunciationFeedback: '학생의 음성이 없어 발음 분석을 할 수 없습니다.',
            rubricScores: { fluency: 0, pronunciation: 0, grammar: 0, vocabulary: 0, interaction: 0 },
        }
    }
    
    // Step 2: Content & Pronunciation Analysis (in parallel) & File Upload (in parallel)
    await updateDoc(resultDocRef, { status: "분석 중: analyze" });
    const analysisPromise = (async () => {
        if (input.useRubric) {
            return withRetry(() => prompts.rubric({ studentTranscript }));
        } else {
            const [contentResult, pronunciationResult] = await Promise.all([
                withRetry(() => prompts.content({
                    studentTranscript,
                    activityPrompt: input.activityPrompt,
                    expectedFormat: input.expectedFormat,
                    studentName: input.studentName,
                    assessmentTitle: input.assessmentTitle,
                })),
                withRetry(() => prompts.pronunciation({
                    studentRecordingUrl: input.studentRecordingDataUri,
                    studentTranscript,
                }))
            ]);
            const contentOutput = contentResult.output;
            const pronunciationOutput = pronunciationResult.output;
            if (!contentOutput || !pronunciationOutput) {
                throw new Error("Failed to get a valid response from one or more analysis models.");
            }
            return { contentOutput, pronunciationOutput };
        }
    })();
    
    // Step 3: While AI is analyzing, upload file to Storage
    await updateDoc(resultDocRef, { status: "분석 중: upload" });
    const studentUid = input.studentName; 
    const uploadPath = `recordings/${studentUid}_${input.assessmentTitle}_${Date.now()}.webm`;
    const storageRef = ref(storage, uploadPath);
    const uploadPromise = uploadString(storageRef, input.studentRecordingDataUri, 'data_url');
    
    // Step 4: Await all parallel tasks and process results
    await updateDoc(resultDocRef, { status: "분석 중: report" });
    const [analysisResult, uploadSnapshot] = await Promise.all([analysisPromise, uploadPromise]);
    const downloadURL = await getDownloadURL(uploadSnapshot.ref);
    
    let finalResult: z.infer<typeof CombinedAnalysisOutputSchema>;

    if ('text' in analysisResult) { // This means it's a rubric result
        const rubricText = analysisResult.text;
        const fluencyMatch = rubricText.match(/🗣️ 유창성 \(Fluency\)\s*-\s*📈 점수:\s*(\d)/);
        const pronunciationMatch = rubricText.match(/🎤 발음 및 억양 \(Pronunciation & Intonation\)\s*-\s*📈 점수:\s*(\d)/);
        const grammarMatch = rubricText.match(/✍️ 문법 \(Grammar\)\s*-\s*📈 점수:\s*(\d)/);
        const vocabularyMatch = rubricText.match(/📚 어휘 \(Vocabulary\)\s*-\s*📈 점수:\s*(\d)/);

        const fluencyScoreRaw = fluencyMatch ? parseInt(fluencyMatch[1], 10) : 0;
        const pronunciationScoreRaw = pronunciationMatch ? parseInt(pronunciationMatch[1], 10) : 0;
        const grammarScoreRaw = grammarMatch ? parseInt(grammarMatch[1], 10) : 0;
        const vocabularyScoreRaw = vocabularyMatch ? parseInt(vocabularyMatch[1], 10) : 0;
        
        const rubricScores: RubricScores = {
          fluency: fluencyScoreRaw,
          pronunciation: pronunciationScoreRaw,
          grammar: grammarScoreRaw,
          vocabulary: vocabularyScoreRaw,
        };
        
        const contentScore = Math.round(((fluencyScoreRaw + grammarScoreRaw + vocabularyScoreRaw) / 3) * 20);
        const pronunciationScore = pronunciationScoreRaw * 20;

        finalResult = {
            studentTranscript,
            studentRecordingUrl: downloadURL,
            contentScore: contentScore,
            pronunciationScore: pronunciationScore,
            aiFeedback: rubricText,
            teacherGuidance: "루브릭 기반 평가를 사용했습니다. 학생의 강점과 약점을 항목별로 확인하고, 개선점에 제시된 활동을 지도해주세요.",
            curricularRemarks: `'${input.assessmentTitle}' 평가에서 루브릭 기반으로 유창성(${fluencyScoreRaw}점), 문법(${grammarScoreRaw}점), 어휘(${vocabularyScoreRaw}점) 영역에서 종합 ${contentScore}점, 발음 영역에서 ${pronunciationScore}점을 받는 등 준수한 성취를 보임.`,
            pronunciationFeedback: `루브릭 기반 발음 점수는 ${pronunciationScore}점입니다. 상세 내용은 종합 분석 리포트를 참고하세요.`,
            rubricScores,
        };
    } else {
        const { contentOutput, pronunciationOutput } = analysisResult as { contentOutput: z.infer<typeof ContentAnalysisOutputSchema>, pronunciationOutput: z.infer<typeof PronunciationAnalysisOutputSchema> };
        finalResult = {
            studentTranscript,
            studentRecordingUrl: downloadURL,
            contentScore: contentOutput.contentScore,
            aiFeedback: contentOutput.aiFeedback,
            teacherGuidance: contentOutput.teacherGuidance,
            curricularRemarks: contentOutput.curricularRemarks,
            pronunciationScore: pronunciationOutput.pronunciationScore,
            pronunciationFeedback: pronunciationOutput.pronunciationFeedback,
        };
    }

    return finalResult;
  }
);

    