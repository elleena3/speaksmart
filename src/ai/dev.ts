import { config } from 'dotenv';
config();

import '@/ai/flows/generate-speaking-feedback.ts';
import '@/ai/flows/draft-curricular-remarks.ts';
import '@/ai/flows/summarize-student-feedback.ts';