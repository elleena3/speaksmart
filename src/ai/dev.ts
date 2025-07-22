
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
import '@/ai/flows/transcribe-file.ts';
import '@/ai/flows/analyze-pronunciation.ts'; // New flow for the main page tool

// New, separated flows for monologue and dialogue analysis
import '@/ai/flows/generate-monologue-analysis-flow';
import '@/ai/flows/generate-dialogue-analysis-flow';

// New flow for the Misc page's real-time conversation tool
import '@/ai/flows/create-native-teacher-flow';
import '@/ai/flows/create-concurrent-teacher-flow'; // New flow for concurrent recording tool

// New flow for the Misc page's read-aloud tool
import '@/ai/flows/analyze-read-aloud-flow';

// New flow for the Misc page's handwriting analysis tool
import '@/ai/flows/analyze-handwriting-flow';

// New flow for growth analysis
import '@/ai/flows/generate-growth-feedback-flow';

// New flow for retrying analysis
import '@/ai/flows/retry-analysis-flow';

// New flow for presentation analysis
import '@/ai/flows/analyze-presentation-video-flow';

// New flow for recalculating rubric scores
import '@/ai/flows/recalculate-scores-flow';
    
