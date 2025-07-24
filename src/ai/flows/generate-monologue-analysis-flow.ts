

'use server';

/**
 * @fileOverview A comprehensive flow that analyzes a student's MONOLOGUE English performance.
 * It orchestrates transcription, content analysis, and pronunciation analysis in an efficient, parallel manner.
 *
 * - generateMonologueAnalysisFlow - The main flow to call for a full monologue speaking assessment.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import {
  ContentAnalysisOutputSchema,
  PronunciationAnalysisOutputSchema,
  CombinedAnalysisOutputSchema,
} from '@/lib/types/ai-schemas';
import { evaluationModels, type RubricScores, type StudentResult } from '@/lib/types';
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
  teacherUid: z.string().describe("The UID of the teacher who created the assessment."),
});
type MonologueProcessingInput = z.infer<typeof MonologueProcessingInputSchema>;

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
        console.warn(`[withRetry] Attempt ${i + 1} failed due to model overload. Retrying in ${delay}ms...`);
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
    1.  **Generate Feedback for the Student ('aiFeedback'):** Write encouraging and constructive feedback in Markdown format. Use headings (e.g., "### 👍 잘했어요 (What you did well)") and bullet points. Focus on fluency, grammar, and vocabulary in relation to the prompt. Include specific examples from their transcript and suggest alternative English vocabulary or sentence structures.
    2.  **Generate Guidance for the Teacher ('teacherGuidance'):** Provide actionable advice for the classroom teacher on how to help this student. Suggest specific English teaching activities or focus areas.
    3.  **Draft '생활기록부 교과 특기 사항' ('curricularRemarks'):** Write official school record remarks in a formal, descriptive tone with sentences ending in '~함' or '~임'. The remarks must be based on the student's performance in this specific task, summarizing their performance and linking it to English competencies. Follow a 3-part structure: ① General participation, ② Specific examples from their speech, ③ Collaboration/other character traits.
    4.  **Assign a Content Score ('contentScore'):** Give a score from 0 to 100 for the *content* of the response based on how well it aligns with the prompt and criteria.
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
      prompt: `당신은 숙련된 프론트엔드 개발자입니다. 아래 요구사항에 맞춰 AI 영어 회화 능력 분석 보고서를 표시하는 단일 HTML 웹페이지를 제작해 주세요.

1. 최종 목표:
사용자의 영어 회화 능력 분석 결과를 보여주는, 시각적으로 깔끔하고 반응형으로 동작하는 웹페이지를 생성합니다. 결과물은 별도의 파일 없이 하나의 HTML 파일로만 구성되어야 합니다.

2. 콘텐츠 구조 (HTML):

전체 제목: 페이지 상단에 <h1> 태그를 사용하여 "📊 AI 영어회화 상세 분석" 제목을 추가합니다.

분석 항목: 아래 5가지 분석 항목을 각각의 섹션으로 만듭니다. 각 항목은 <div class="category-card">로 감싸주세요.

🗣️ 유창성 (Fluency)

🎤 발음 및 억양 (Pronunciation & Intonation)

✍️ 문법 (Grammar)

📚 어휘 (Vocabulary)

🤝 내용 이해 및 상호작용 (Comprehension & Interaction)

항목별 헤더: 각 분석 항목 카드 상단에는 항목명(<h2>)과 점수(<span>)를 표시합니다. 점수는 "📈 점수: X / 5점" 형식입니다.

상세 내용: 각 항목 카드 내부에 "잘한 점"과 "개선점"을 나란히 비교할 수 있는 두 개의 박스를 만듭니다.

"👍 잘한 점" 박스 (<div class="detail-box good-points">)

"💡 개선점" 박스 (<div class="detail-box improvement-points">)

각 박스 안에는 소제목(<h3>)과 <ul>, <li> 태그를 사용하여 상세 내용을 목록으로 정리합니다. (내용은 아래 제공된 텍스트를 사용)

3. 디자인 및 스타일 (CSS):

레이아웃:

Flexbox를 사용하여 "잘한 점"과 "개선점" 박스를 가로로 배치합니다.

전체 콘텐츠는 페이지 중앙에 오도록 하고, max-width: 900px를 설정하여 가독성을 확보합니다.

반응형 디자인:

필수: 화면 너비가 768px 이하가 되면, "잘한 점"과 "개선점" 박스가 세로로 쌓이도록 미디어 쿼리(@media)를 설정해야 합니다.

색상 및 효과:

전체 페이지 배경은 연한 회색 (#f4f7f9), 콘텐츠 카드는 흰색 (#ffffff)으로 지정합니다.

"잘한 점" 박스: 긍정적 느낌을 주는 연한 녹색 계열(background-color: #e8f5e9, border-left: 5px solid #4caf50)로 스타일링합니다.

"개선점" 박스: 주목도를 높이는 연한 주황색 계열(background-color: #fff3e0, border-left: 5px solid #ff9800)으로 스타일링합니다.

각 분석 항목 카드에 마우스를 올리면 그림자(box-shadow) 효과가 살짝 나타나도록 하여 상호작용성을 높여주세요.

폰트: font-family는 Apple과 Windows 시스템에서 모두 깔끔하게 보이는 기본 산세리프 폰트 (예: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)로 설정합니다.

4. 기술 요구사항:

모든 CSS 코드는 HTML 파일 내 <head> 섹션의 <style> 태그 안에 포함시켜야 합니다.

외부 CSS 라이브러리(Bootstrap, Tailwind CSS 등)는 사용하지 않습니다.

코드의 각 부분에 주석을 달아 어떤 역할을 하는지 설명해주세요.

[사용자 발화 내용]
{{{studentTranscript}}}

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
이 항목은 대화형 시나리오에서만 평가합니다. 혼자 말하기 과제였으므로 이 항목은 1점으로 고정하고, 피드백은 '평가 대상 아님'으로 작성합니다.
`,
    }),
});


// The Main Orchestration Flow
export const generateMonologueAnalysisFlow = ai.defineFlow(
  {
    name: 'generateMonologueAnalysisFlow',
    inputSchema: MonologueProcessingInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    const model = input.evaluationModel || 'gemini-2.5-flash';
    const prompts = createPrompt(model);
    const resultDocRef = doc(db, "results", input.resultId);
    let downloadURL = ""; // To store the URL for retry purposes

    try {
      // Step 1: Upload File to Storage first (can happen in parallel with first AI call)
      await updateDoc(resultDocRef, { status: "분석 중: upload", assessmentType: "monologue" });
      console.log("[Flow] Step 1: Uploading audio file to Storage.");
      const studentUid = input.studentName; 
      const uploadPath = `recordings/${studentUid}_${input.assessmentTitle}_${Date.now()}.webm`;
      const storageRef = ref(storage, uploadPath);
      const uploadTask = uploadString(storageRef, input.studentRecordingDataUri, 'data_url');
      
      // Step 2: Transcribe the audio
      await updateDoc(resultDocRef, { status: "분석 중: transcribe" });
      console.log("[Flow] Step 2: Transcribing audio.");
      const transcriptionResult = await withRetry(() => prompts.transcription({ studentRecordingUrl: input.studentRecordingDataUri }));
      const studentTranscript = transcriptionResult.text;

      if (!studentTranscript || studentTranscript.trim() === "" || studentTranscript.includes('기록되지 않았습니다') || studentTranscript.includes('인식하지 못했습니다')) {
          throw new Error('학생 답변을 인식하지 못했습니다. 마이크 상태를 확인하고 다시 시도해주세요.');
      }
      
      // Wait for the upload to finish and get the URL
      const uploadSnapshot = await uploadTask;
      downloadURL = await getDownloadURL(uploadSnapshot.ref);
      console.log("[Flow] Audio uploaded, URL:", downloadURL);

      // Step 3: Content & Pronunciation Analysis (in parallel)
      await updateDoc(resultDocRef, { status: "분석 중: analyze" });
      console.log("[Flow] Step 3: Starting content and pronunciation analysis in parallel.");
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
      
      const analysisResult = await analysisPromise;
      console.log("[Flow] Analysis complete.");
      
      // Step 4: Process results and generate final report object
      await updateDoc(resultDocRef, { status: "분석 중: report" });
      console.log("[Flow] Step 4: Generating final report.");
      
      let finalResult: z.infer<typeof CombinedAnalysisOutputSchema>;

      if ('text' in analysisResult) { // This means it's a rubric result
          let rubricText = analysisResult.text;
          // Clean up the text just in case the model still wraps it
          if (rubricText.startsWith("```html")) {
              rubricText = rubricText.substring(7, rubricText.length - 3).trim();
          }
          
          const rubricScores: RubricScores = {
            fluency: parseScore(rubricText, '유창성'),
            pronunciation: parseScore(rubricText, '발음 및 억양'),
            grammar: parseScore(rubricText, '문법'),
            vocabulary: parseScore(rubricText, '어휘'),
          };
          
          const contentScore = Math.round(((rubricScores.fluency + rubricScores.grammar + rubricScores.vocabulary) / 3) * 20);
          const pronunciationScore = rubricScores.pronunciation * 20;

          finalResult = {
              studentTranscript,
              contentScore: contentScore,
              pronunciationScore: pronunciationScore,
              aiFeedback: rubricText,
              teacherGuidance: "루브릭 기반 평가를 사용했습니다. 학생의 강점과 약점을 항목별로 확인하고, 개선점에 제시된 활동을 지도해주세요.",
              curricularRemarks: `'${input.assessmentTitle}' 평가에서 루브릭 기반으로 유창성(${rubricScores.fluency}점), 문법(${rubricScores.grammar}점), 어휘(${rubricScores.vocabulary}점) 영역에서 종합 ${contentScore}점, 발음 영역에서 ${pronunciationScore}점을 받는 등 준수한 성취를 보임.`,
              pronunciationFeedback: `루브릭 기반 발음 점수는 ${pronunciationScore}점입니다. 상세 내용은 종합 분석 리포트를 참고하세요.`,
              rubricScores,
          };
      } else {
          const { contentOutput, pronunciationOutput } = analysisResult as { contentOutput: z.infer<typeof ContentAnalysisOutputSchema>, pronunciationOutput: z.infer<typeof PronunciationAnalysisOutputSchema> };
          finalResult = {
              studentTranscript,
              contentScore: contentOutput.contentScore,
              aiFeedback: contentOutput.aiFeedback,
              teacherGuidance: contentOutput.teacherGuidance,
              curricularRemarks: contentOutput.curricularRemarks,
              pronunciationScore: pronunciationOutput.pronunciationScore,
              pronunciationFeedback: pronunciationOutput.pronunciationFeedback,
          };
      }
      
      console.log("[Flow] Final report generated. Updating Firestore document.");
      
      // Update the main document with the final analysis and set status to complete
      await updateDoc(resultDocRef, {
          ...finalResult,
          studentRecordingUrl: downloadURL,
          status: "채점 완료",
          teacherUid: input.teacherUid,
          assessmentType: "monologue",
      });

      console.log(`[Flow] Final result document ${input.resultId} updated. Status: '채점 완료'`);
    } catch(e) {
       console.error("[Flow] An error occurred in generateMonologueAnalysisFlow", e);
       await updateDoc(resultDocRef, { 
          status: '오류', 
          aiFeedback: (e as Error).message || "알 수 없는 오류가 발생했습니다.",
          studentRecordingUrl: downloadURL || "" // Save URL even on failure if available
       });
       // Re-throw the error to be caught by the client-side caller if needed
       throw e;
    }
  }
);
