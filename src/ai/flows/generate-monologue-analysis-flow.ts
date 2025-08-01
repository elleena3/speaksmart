

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
  for (let i = 0; i < retries; i++) {
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
const createPrompt = (modelName: z.infer<typeof evaluationModels[number]>) => {
    const isGoogleModel = modelName.startsWith('gemini');
    const model = isGoogleModel ? googleAI.model(modelName) : modelName;

    return {
    transcription: ai.definePrompt({
        name: `transcribeAudioPrompt_${modelName.replace(/[\/-.]/g, '_')}`,
        model: model, 
        prompt: `Transcribe this English audio. If the audio is silent or contains no discernible speech, return an empty string. Do not correct any grammatical errors or mispronunciations. Transcribe exactly what is heard.
    Audio: {{media url=studentRecordingUrl}}
    `,
    }),
    content: ai.definePrompt({
      name: `monologueContentAnalysisPrompt_${modelName.replace(/[\/-.]/g, '_')}`,
      model: model,
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
        name: `monologuePronunciationAnalysisPrompt_${modelName.replace(/[\/-.]/g, '_')}`,
        model: model,
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
      name: `monologueRubricAnalysisPrompt_${modelName.replace(/[\/-.]/g, '_')}`,
      model: model,
      input: { schema: z.object({ studentTranscript: z.string() }) },
      prompt: `You are an HTML generation machine. Your ONLY task is to create a complete, single HTML file for a web-based report based on the user's speech and the provided rubric.

IMPORTANT INSTRUCTION: Your output MUST be ONLY the HTML code, starting with <!DOCTYPE html> and ending with </html>. Do NOT include any other text, explanations, or markdown code blocks (like \`\`\`html) before or after the HTML content.

### User's Speech Content:
{{{studentTranscript}}}

### HTML Generation Requirements:

#### 1. Content Structure:
-   **Main Title:** Use an \`<h1>\` tag for "📊 AI 영어회화 상세 분석".
-   **Category Cards:** Create a \`<div>\` with class "category-card" for each of the 5 analysis categories:
    -   🗣️ 유창성 (Fluency)
    -   🎤 발음 및 억양 (Pronunciation & Intonation)
    -   ✍️ 문법 (Grammar)
    -   📚 어휘 (Vocabulary)
    -   🤝 내용 이해 및 상호작용 (Comprehension & Interaction)
-   **Card Header:** Inside each card, use an \`<h2>\` for the category title and a \`<span>\` with class "score-display" for the score (e.g., "📈 점수: 4 / 5점").
-   **Card Details:** Inside each card, below the header, create a \`<div class="detail-flex-container">\`. Inside this container, create two boxes:
    -   \`<div class="detail-box good-points">\` for "👍 잘한 점".
    -   \`<div class="detail-box improvement-points">\` for "💡 개선점".
-   **Box Content:** Each "detail-box" must have an \`<h3>\` for its title and a \`<ul>\` with \`<li>\` elements for the detailed feedback points.

#### 2. Design & Style (MUST be inside a \`<style>\` tag in the \`<head>\`):
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

### Evaluation Rubric (Use this to determine scores and feedback for each category):

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
This item is for dialogue scenarios only. As this is a monologue task, this item MUST be scored as 1 point, and the feedback should state '평가 대상 아님'.

Now, generate the HTML code.
`,
    }),
    teacherGuidance: ai.definePrompt({
      name: `monologueTeacherGuidancePrompt_${modelName.replace(/[\/-.]/g, '_')}`,
      model: model,
      input: { schema: z.object({ studentFeedbackHtml: z.string() }) },
      prompt: `You are an expert English education consultant. Your task is to provide actionable advice to a teacher based on an AI-generated feedback report for a student.

The following is an HTML report containing a detailed rubric-based analysis of a student's English speaking performance. Read it carefully.

### Student Feedback Report (HTML):
{{{studentFeedbackHtml}}}

### Your Task:
Based on the provided HTML report, write concise and actionable guidance for the teacher in Korean. Your advice should:
1.  Summarize the student's key strengths and weaknesses across all categories.
2.  Suggest specific activities, teaching strategies, or areas of focus to help the student improve.
3.  Be professional, encouraging, and easy for a teacher to understand and implement.

Please provide only the teacher guidance text.`,
    }),
}};


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
      // Step 1: Upload File to Storage first
      await updateDoc(resultDocRef, { status: "분석 중: upload", assessmentType: "monologue" });
      console.log("[Flow] Step 1: Uploading audio file to Storage.");
      const uploadPath = `recordings/${input.studentName}_${input.assessmentTitle}_${Date.now()}.webm`;
      const storageRef = ref(storage, uploadPath);
      const uploadTask = uploadString(storageRef, input.studentRecordingDataUri, 'data_url');
      
      // Step 2: Transcribe the audio
      await updateDoc(resultDocRef, { status: "분석 중: transcribe" });
      console.log("[Flow] Step 2: Transcribing audio.");
      const transcriptionResult = await withRetry(() => prompts.transcription.generate({ input: { studentRecordingUrl: input.studentRecordingDataUri } }));
      const studentTranscript = transcriptionResult.text();

      if (!studentTranscript || studentTranscript.trim() === "" || studentTranscript.includes('기록되지 않았습니다') || studentTranscript.includes('인식하지 못했습니다')) {
          throw new Error('학생 답변을 인식하지 못했습니다. 마이크 상태를 확인하고 다시 시도해주세요.');
      }
      
      const uploadSnapshot = await uploadTask;
      downloadURL = await getDownloadURL(uploadSnapshot.ref);
      console.log("[Flow] Audio uploaded, URL:", downloadURL);

      // Step 3: Content & Pronunciation Analysis
      await updateDoc(resultDocRef, { status: "분석 중: analyze" });
      console.log("[Flow] Step 3: Starting analysis.");
      
      let finalResult: z.infer<typeof CombinedAnalysisOutputSchema>;

      if (input.useRubric) {
          const rubricResult = await withRetry(() => prompts.rubric.generate({ input: { studentTranscript } }));
          let rubricText = rubricResult.text();
          if (rubricText.startsWith("```html")) {
              rubricText = rubricText.substring(7, rubricText.length - 3).trim();
          }
          
          const rubricScores: RubricScores = {
            fluency: parseScore(rubricText, '유창성'),
            pronunciation: parseScore(rubricText, '발음 및 억양'),
            grammar: parseScore(rubricText, '문법'),
            vocabulary: parseScore(rubricText, '어휘'),
            interaction: 1, 
          };
          
          const contentScore = Math.round(((rubricScores.fluency + rubricScores.grammar + rubricScores.vocabulary) / 3) * 20);
          const pronunciationScore = rubricScores.pronunciation * 20;

          // New step: Generate teacher guidance based on the rubric HTML
          const guidanceResult = await withRetry(() => prompts.teacherGuidance.generate({ input: { studentFeedbackHtml: rubricText }}));

          finalResult = {
              studentTranscript,
              contentScore: contentScore,
              pronunciationScore: pronunciationScore,
              aiFeedback: rubricText,
              teacherGuidance: guidanceResult.text(),
              curricularRemarks: `'${input.assessmentTitle}' 평가에서 루브릭 기반으로 유창성(${rubricScores.fluency}점), 문법(${rubricScores.grammar}점), 어휘(${rubricScores.vocabulary}점) 영역에서 종합 ${contentScore}점, 발음 영역에서 ${pronunciationScore}점을 받는 등 준수한 성취를 보임.`,
              pronunciationFeedback: `루브릭 기반 발음 점수는 ${pronunciationScore}점입니다. 상세 내용은 종합 분석 리포트를 참고하세요.`,
              rubricScores,
          };
      } else {
          const [contentResult, pronunciationResult] = await Promise.all([
              withRetry(() => prompts.content.generate({
                input: {
                    studentTranscript,
                    activityPrompt: input.activityPrompt,
                    expectedFormat: input.expectedFormat,
                    studentName: input.studentName,
                    assessmentTitle: input.assessmentTitle,
                }
              })),
              withRetry(() => prompts.pronunciation.generate({
                input: {
                    studentRecordingDataUri: input.studentRecordingDataUri,
                    studentTranscript,
                }
              }))
          ]);
          const contentOutput = contentResult.output();
          const pronunciationOutput = pronunciationResult.output();
          if (!contentOutput || !pronunciationOutput) {
              throw new Error("Failed to get a valid response from one or more analysis models.");
          }
          finalResult = {
              studentTranscript,
              contentScore: contentOutput.contentScore,
              aiFeedback: contentOutput.aiFeedback,
              teacherGuidance: contentOutput.teacherGuidance,
              curricularRemarks: contentOutput.curricularRemarks || '', // Ensure it's not undefined
              pronunciationScore: pronunciationOutput.pronunciationScore,
              pronunciationFeedback: pronunciationOutput.pronunciationFeedback,
          };
      }
      
      console.log("[Flow] Analysis complete. Generating final report.");
      await updateDoc(resultDocRef, { status: "분석 중: report" });
      
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
          studentRecordingUrl: downloadURL || ""
       });
       throw e;
    }
  }
);
