import { type ConversationTurn, type ResultSummarySchema, type RubricCriterion, type RubricCriterionScore, type RubricEvaluation } from "@/lib/types/ai-schemas";
import { z } from 'zod';

export const scenarios = ["free-talk", "ordering-food", "airport-check-in", "shopping"] as const;
export type Scenario = (typeof scenarios)[number];

/**
 * 대화형 평가의 '통화 엔진'.
 *
 * turn        — 버튼을 눌러 주고받습니다. 한 턴에 전사·답변·음성합성을 차례로 불러
 *               학생이 멈춘 뒤 약 10초를 기다립니다.
 * realtime    — OpenAI Realtime 과 WebRTC 로 음성을 직접 주고받습니다.
 *               말이 끝나면(무음 0.5초) 자동으로 턴이 넘어가고 끼어들기도 됩니다.
 * gemini-live — Vertex AI Live 와 WebSocket 으로 주고받습니다. 역시 끊김이 없습니다.
 *               브라우저에는 1시간 만료 토큰만 내려갑니다(API 키 원본이 아닙니다).
 *
 * 채점 방식은 두 엔진이 같습니다(대화 분석 플로우). 엔진은 '어떻게 대화했는가'일
 * 뿐이라 assessmentType 은 그대로 'dialogue' 를 씁니다. 그래서 결과·루브릭·성장
 * 추이·다시 채점 경로가 모두 손대지 않고 그대로 동작합니다.
 */
export const conversationModes = ["turn", "realtime", "gemini-live"] as const;
export type ConversationMode = (typeof conversationModes)[number];

/** OpenAI Realtime 통화에 쓰는 모델. 교사가 평가를 만들 때 고릅니다. */
export const realtimeModels = [
  { value: "gpt-realtime-2.1-mini", label: "gpt-realtime-2.1-mini (기본, 저렴)" },
  { value: "gpt-realtime-2.1", label: "gpt-realtime-2.1 (고성능)" },
] as const;
export type RealtimeModel = (typeof realtimeModels)[number]["value"];
export const defaultRealtimeModel: RealtimeModel = "gpt-realtime-2.1-mini";

/**
 * OpenAI Realtime 목소리. Gemini TTS 목소리(allVoices)와는 별개 목록입니다.
 *
 * OpenAI 에 엉터리 값을 넣어 직접 받은 지원 목록 10종입니다.
 * marin·cedar 는 GA 모델과 함께 추가된 목소리라 기본값으로 둡니다.
 */
export const realtimeVoices = [
  { value: "marin", label: "Marin (여성·자연스러움, 기본값)" },
  { value: "cedar", label: "Cedar (남성·자연스러움)" },
  { value: "alloy", label: "Alloy (여성·중립)" },
  { value: "echo", label: "Echo (남성·부드러움)" },
  { value: "shimmer", label: "Shimmer (여성·밝음)" },
  { value: "ash", label: "Ash (남성·진지함)" },
  { value: "ballad", label: "Ballad (남성·차분함)" },
  { value: "coral", label: "Coral (여성·상쾌함)" },
  { value: "sage", label: "Sage (여성·전문적)" },
  { value: "verse", label: "Verse (남성·에너제틱)" },
] as const;
export type RealtimeVoice = (typeof realtimeVoices)[number]["value"];
export const defaultRealtimeVoice: RealtimeVoice = "marin";

/**
 * Vertex AI Live 통화 모델. 이 프로젝트에서 실제로 접속되는 것만 적었습니다.
 * (publisher 모델 목록을 받아 live 후보를 추린 뒤 하나씩 setup 을 보내 확인했습니다.)
 */
export const geminiLiveModels = [
  { value: "gemini-3.8-live", label: "gemini-3.8-live (기본, 최신)" },
  { value: "gemini-live-2.5-flash-native-audio", label: "gemini-live-2.5-flash-native-audio (이전 세대)" },
] as const;
export type GeminiLiveModel = (typeof geminiLiveModels)[number]["value"];
export const defaultGeminiLiveModel: GeminiLiveModel = "gemini-3.8-live";

/**
 * Vertex AI Live 목소리. 8종 모두 실제로 받아들여지는 것을 확인했습니다
 * (엉터리 값은 'No matching speaker voice found' 로 거부되므로 의미 있는 확인입니다).
 * OpenAI·Gemini TTS 목소리와는 또 다른 목록입니다.
 */
export const geminiLiveVoices = [
  { value: "Aoede", label: "Aoede (여성·부드러움, 기본값)" },
  { value: "Kore", label: "Kore (여성·또렷함)" },
  { value: "Leda", label: "Leda (여성·밝음)" },
  { value: "Zephyr", label: "Zephyr (여성·차분함)" },
  { value: "Puck", label: "Puck (남성·활기참)" },
  { value: "Charon", label: "Charon (남성·낮고 안정적)" },
  { value: "Fenrir", label: "Fenrir (남성·힘있음)" },
  { value: "Orus", label: "Orus (남성·중립적)" },
] as const;
export type GeminiLiveVoice = (typeof geminiLiveVoices)[number]["value"];
export const defaultGeminiLiveVoice: GeminiLiveVoice = "Aoede";

/**
 * 실시간 대화의 기본 제한 시간(분).
 *
 * 실시간 통화는 접속해 있는 시간만큼 과금됩니다. 제한을 비워 두면 학생이 창을
 * 닫지 않는 한 계속 연결되어 인원×시간으로 비용이 불어납니다. 그래서 기본값을
 * 두고, 교사가 필요하면 늘립니다. 혼자 말하기·턴 방식 기본값(무제한)은 그대로입니다.
 */
export const DEFAULT_REALTIME_TIME_LIMIT_MIN = 2;

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
  // 3.6 은 그대로 둡니다. 그 모델로 응시가 시작된 평가를 계속 부를 수 있어야 합니다.
  "googleai/gemini-3.8-flash",
  "googleai/gemini-3.7-flash",
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
 * 13종을 모두 실제로 응시시켜 본 결과를 반영했습니다.
 * 학생 녹음을 스스로 받는 것은 Gemini 뿐이고, OpenAI·Claude 는 400 으로 거부합니다.
 * 지금은 오디오 대체(src/lib/ai-retry.ts)가 있어 어느 모델을 골라도 채점은
 * 끝까지 완료되지만, 그 경우 전사와 발음 점수는 Gemini 가 매깁니다.
 * 무엇을 스스로 하는지 목록에 적어 두어 교사가 알고 고르게 합니다.
 *
 * Claude 는 뺐습니다. 내용 채점만 놓고 보면 OpenAI 와 사정이 같지만
 * 선택지를 늘려 혼란을 주기보다 최신 GPT 3종으로 비교 폭을 제한했습니다.
 * 구형 gpt-4o·gpt-4o-mini·o3-mini·o1 도 같은 이유로 제외했습니다.
 *
 * 오디오를 다루지 않는 교사 도구(손글씨·유튜브·발표 분석 등)는 계속
 * evaluationModels 전체를 씁니다. Claude 가 정상 동작하기 때문입니다.
 */
export const assessmentEvaluationModels = [
  // 학생 녹음을 스스로 듣고 처리합니다.
  { value: 'googleai/gemini-3.8-flash', label: 'gemini-3.8-flash — 전 과정을 스스로 처리 (빠름, 기본값)' },
  { value: 'googleai/gemini-3.7-flash', label: 'gemini-3.7-flash — 전 과정을 스스로 처리 (빠름)' },
  { value: 'googleai/gemini-3.6-flash', label: 'gemini-3.6-flash — 전 과정을 스스로 처리 (이전 세대)' },
  { value: 'googleai/gemini-3.1-pro-preview', label: 'gemini-3.1-pro-preview — 전 과정을 스스로 처리 (정밀)' },
  // 오디오를 못 받아 전사·발음은 Gemini 가 대신합니다. 내용 채점만 이 모델이 합니다.
  { value: 'openai/gpt-5.6-terra', label: 'gpt-5.6-terra — 내용 채점만 (전사·발음은 Gemini) · 루브릭은 엄격하게 채점' },
  { value: 'openai/gpt-5.6-luna', label: 'gpt-5.6-luna — 내용 채점만 (전사·발음은 Gemini) · 루브릭은 엄격하게 채점' },
  { value: 'openai/gpt-5.6-sol', label: 'gpt-5.6-sol — 내용 채점만 (전사·발음은 Gemini) · 루브릭은 엄격하게 채점' },
] as const satisfies readonly { value: EvaluationModel; label: string }[];

export type AssessmentEvaluationModel = (typeof assessmentEvaluationModels)[number]['value'];

/** z.enum 과 저장값 검사에 쓰는 값 목록 */
export const assessmentEvaluationModelValues = assessmentEvaluationModels.map((m) => m.value) as AssessmentEvaluationModel[];

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
  { value: 'googleai/gemini-3.8-flash',       label: 'gemini-3.8-flash — 정확하고 빠름', pdf: true },
  { value: 'googleai/gemini-3.7-flash',       label: 'gemini-3.7-flash — 정확하고 빠름', pdf: true },
  { value: 'googleai/gemini-3.6-flash',       label: 'gemini-3.6-flash — 이전 세대', pdf: true },
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
  /** dialogue 일 때의 통화 방식. 없으면 'turn'(기존 평가들) 입니다. */
  conversationMode?: ConversationMode;
  /** conversationMode 가 'realtime' 일 때만 씁니다. */
  realtimeModel?: RealtimeModel;
  realtimeVoice?: RealtimeVoice;
  /** conversationMode 가 'gemini-live' 일 때만 씁니다. */
  geminiLiveModel?: GeminiLiveModel;
  geminiLiveVoice?: GeminiLiveVoice;
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
