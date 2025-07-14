import { config } from 'dotenv';
config();

import '@/ai/flows/generate-speaking-feedback.ts';
import '@/ai/flows/draft-curricular-remarks.ts';
import '@/ai/flows/summarize-student-feedback.ts';
import '@/ai/flows/text-to-speech.ts';
import '@/ai/flows/generate-content-feedback.ts';
import '@/ai/flows/generate-pronunciation-feedback.ts';
