
import { config } from 'dotenv';
config();

// The following flows are now integrated into the new analysis flow
// and no longer need to be individually registered for direct client use.
// import '@/ai/flows/generate-content-feedback.ts';
// import '@/ai/flows/generate-pronunciation-feedback.ts';

// These flows are still used independently.
import '@/ai/flows/draft-curricular-remarks.ts';
import '@/ai/flows/summarize-student-feedback.ts';
import '@/ai/flows/text-to-speech.ts';

// New, separated flows for monologue and dialogue analysis
import '@/ai/flows/generate-monologue-analysis-flow';
import '@/ai/flows/generate-dialogue-analysis-flow';

    