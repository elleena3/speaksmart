import { type ConversationTurn, type ResultSummarySchema, type RubricCriterion, type RubricCriterionScore, type RubricEvaluation } from "@/lib/types/ai-schemas";
import { z } from 'zod';

export const scenarios = ["free-talk", "ordering-food", "airport-check-in", "shopping"] as const;
export type Scenario = (typeof scenarios)[number];

// Google Cloud TTS Voice list updated for accuracy
export const femaleVoices = ["laomedeia", "callirrhoe", "autonoe", "erinome"] as const;
export const maleVoices = ["achernar", "algenib", "gacrux", "iapetus", "orus", "puck", "schedar", "zubenelgenubi"] as const;
export const allVoices = [...femaleVoices, ...maleVoices] as const;
export type AiVoice = (typeof allVoices)[number];

// Descriptions updated for accuracy
export const voiceDescriptions: Record<AiVoice, string> = {
  // Female
  laomedeia: "부드럽고 차분한 톤 (여성)",
  callirrhoe: "안정적이고 신뢰감 있는 톤 (여성)",
  autonoe: "활기차고 밝은 톤 (여성)",
  erinome: "깊고 성숙한 톤 (여성)",
  // Male
  achernar: "명료하고 전문적인 톤 (남성)",
  algenib: "중립적이고 표준적인 톤 (남성)",
  gacrux: "부드럽고 감성적인 톤 (남성)",
  iapetus: "깊고 권위 있는 톤 (남성)",
  orus: "활기차고 설득력 있는 톤 (남성)",
  puck: "명료하고 교육적인 톤 (남성)",
  schedar: "따뜻하고 친근한 톤 (남성)",
  zubenelgenubi: "밝고 긍정적인 톤 (남성)",
};

export const evaluationModels = [
  // Google AI Models
  "googleai/gemini-3.6-flash",
  "googleai/gemini-3.1-pro-preview",
  // OpenAI Models
  // 비용 차이가 커서(sol 이 luna 의 5배) 권장 기본값인 terra 를 앞에 둡니다.
  "openai/gpt-5.6-terra",
  "openai/gpt-5.6-luna",
  "openai/gpt-5.6-sol",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/o3-mini",
  "openai/o1",
  // Anthropic Models
  "anthropic/claude-fable-5",
  "anthropic/claude-opus-4-8",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-haiku-4-5"
] as const;
export type EvaluationModel = (typeof evaluationModels)[number];

/**
 * 평가(응시)에서 교사가 고를 수 있는 모델.
 *
 * Claude 는 오디오를 받지 못합니다. monologue·dialogue 평가는 전사 단계에서
 * 학생 녹음을 교사가 고른 모델로 그대로 보내므로, Claude 를 고르면 채점이
 * 반드시 실패합니다. (Anthropic API 가 400 으로 거부하는 것을 실제 호출로 확인)
 *
 * 오디오를 다루지 않는 교사 도구(손글씨·유튜브·발표 분석 등)는 계속
 * evaluationModels 전체를 씁니다. Claude 가 정상 동작하기 때문입니다.
 */
export type AssessmentEvaluationModel = Exclude<EvaluationModel, `anthropic/${string}`>;
export const assessmentEvaluationModels = evaluationModels.filter(
  (m): m is AssessmentEvaluationModel => !m.startsWith('anthropic/')
);

/**
 * 루브릭 파일에서 평가기준안을 뽑을 때 고를 수 있는 모델.
 *
 * 같은 루브릭 표(4항목·12수준)를 PNG·PDF 로 넣어 실제로 비교한 결과를 반영했습니다.
 * 채점(gradeWithRubric)은 이 선택과 무관하게 지금 방식을 그대로 씁니다.
 *
 * `pdf: false` 인 모델은 PDF 를 아예 받지 못합니다(Anthropic API 가 400 으로 거부).
 * gpt-4o 는 PDF 에서 원문에 없는 수준 설명을 지어내어(12/24) 목록에서 뺐습니다.
 */
export const rubricAnalysisModels = [
  { value: 'googleai/gemini-3.1-pro-preview', label: 'gemini-3.1-pro-preview — 이미지·PDF 모두 정확 (느림)', pdf: true },
  { value: 'googleai/gemini-3.6-flash',       label: 'gemini-3.6-flash — 정확하고 빠름', pdf: true },
  { value: 'openai/gpt-5.6-terra',            label: 'gpt-5.6-terra — 가장 빠르고 정확', pdf: true },
  { value: 'openai/gpt-5.6-luna',             label: 'gpt-5.6-luna — 정확', pdf: true },
  { value: 'anthropic/claude-fable-5',        label: 'claude-fable-5 — 이미지 전용, 정확', pdf: false },
  { value: 'anthropic/claude-opus-4-8',       label: 'claude-opus-4-8 — 이미지 전용, 정확', pdf: false },
  { value: 'anthropic/claude-sonnet-5',       label: 'claude-sonnet-5 — 이미지 전용, 정확', pdf: false },
  { value: 'anthropic/claude-haiku-4-5',      label: 'claude-haiku-4-5 — 이미지 전용, 한글 오탈자 있음', pdf: false },
] as const;
export type RubricAnalysisModel = (typeof rubricAnalysisModels)[number]['value'];
export const defaultRubricAnalysisModel: RubricAnalysisModel = 'googleai/gemini-3.1-pro-preview';

export const imageGenerationModels = [
  // 이름이 정확해야 합니다. 예전 값 'gemini-3.1-flash-lite-image' 는 존재하지 않는 모델이라
  // 이미지 생성이 NOT_FOUND 로 실패했습니다.
  "googleai/gemini-3.1-flash-image",
  "googleai/gemini-3-pro-image",
  "openai/gpt-image-2"
] as const;
export type ImageGenerationModel = (typeof imageGenerationModels)[number];


export const monologueTypes = ["text", "image", "comic"] as const;
export type MonologueType = (typeof monologueTypes)[number];


// New UserData type for Firestore
export type UserData = {
  uid: string;
  docId?: string; // Firestore document ID
  email: string;
  displayName: string;
  photoURL: string;
  role: 'student' | 'teacher';
  grade?: string;
  class?: string;
  number?: string;
  // 비밀번호는 Firebase Auth가 보관합니다. Firestore에 저장하지 않습니다.
  isMock?: boolean; // To identify mock users
  createdAt: number;
};


export type Assessment = {
  id: string;
  title: string;
  topic: string;
  prompt: string;
  status: '할 일' | '완료' | '채점 완료';
  assessmentType: 'monologue' | 'dialogue';
  scenario?: Scenario;
  // Firestore fields
  uid?: string; // Teacher's UID
  createdAt?: number;
};

export type TeacherAssessment = {
  id: string; // Firestore document ID
  uid: string; // Teacher's UID
  title: string;
  topic: string;
  prompt: string;
  imageUrl?: string; // For image-based assessments
  averageScore: number;
  submissionCount: number;
  dateCreated: string;
  startDate?: string;
  endDate?: string;
  assessmentType: 'monologue' | 'dialogue';
  monologueType?: MonologueType;
  scenario?: Scenario;
  aiVoice?: AiVoice;
  evaluationModel?: EvaluationModel;
  imageGenerationModel?: ImageGenerationModel;
  expectedFormat?: string;
  recordingTimeLimit?: number; // Optional recording time limit in minutes
  targetStudentIds: string[] | 'all'; // 'all' or array of student UIDs
  useRubric?: boolean; // New field for rubric option
  // For Firestore timestamp
  createdAt: number;
  submissions?: { [studentId: string]: 'completed' | 'in_progress' };
  loadedRubricId?: string;
};

export type { ConversationTurn };
export type ResultSummary = z.infer<typeof ResultSummarySchema>;

export type HistoricalScore = {
  attempt: number;
  contentScore: number;
  pronunciationScore: number;
  rubricScores?: RubricScores;
};

export type ConversationHistory = {
  history: ConversationTurn[];
  studentRecordingUrl?: string;
}

export type ResultStatus =
  | "채점 완료"
  | "오류"
  | "분석 중"
  | "분석 중: upload"
  | "분석 중: transcribe"
  | "분석 중: analyze"
  | "분석 중: report";


/**
 * @deprecated 항목이 5개로 고정되어 교사가 만든 루브릭을 담지 못합니다.
 * 새 채점은 rubricEvaluation 을 사용합니다. 이 타입은 예전에 채점된
 * 결과를 화면에 계속 표시하기 위해서만 남겨 둡니다.
 */
export type RubricScores = {
  fluency: number;
  pronunciation: number;
  grammar: number;
  vocabulary: number;
  interaction?: number; // Optional for monologue
};

export type { RubricCriterion, RubricCriterionScore, RubricEvaluation };

export type StudentResult = {
  id: string; // Firestore document ID
  studentId: string; // Student's UID
  assessmentId: string;
  assessmentTitle: string;
  assessmentType?: 'monologue' | 'dialogue'; // Keep track of type for reprocessing
  name: string; // Student's display name
  avatarUrl: string;
  status: ResultStatus;
  date: string;
  aiFeedback: string;
  studentFeedbackSummary: string;
  studentRawFeedback?: string; // 원본 피드백 저장
  teacherGuidance: string;
  pronunciationFeedback: string;
  studentTranscript?: string;
  studentRecordingUrl?: string; // Changed from DataUri to URL
  pronunciationScore?: number;
  teacherUid: string; // To query results by teacher
  createdAt: number;
  contentScore: number;
  curricularRemarks: string;
  /** @deprecated 예전 고정 5항목 채점 결과. 새 채점은 rubricEvaluation 을 씁니다. */
  rubricScores?: RubricScores;
  /** 교사가 만든 루브릭으로 채점한 결과. 항목 수와 배점이 루브릭을 그대로 따릅니다. */
  rubricEvaluation?: RubricEvaluation;
  rubricName?: string;
  historicalScores?: HistoricalScore[];
  growthFeedback?: string;
  growthTeacherGuidance?: string;
  growthCurricularRemarks?: string;
  growthFeedbackForAttempts?: number;
}
