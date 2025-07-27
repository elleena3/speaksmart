
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {firebase} from '@genkit-ai/firebase';
import { firebaseConfig } from '@/lib/firebase'; // Import from the single source of truth

// IMPORTANT: Using hardcoded config to resolve persistent invalid-api-key issues.
const hardcodedApiKey = "YOUR_API_KEY";

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: hardcodedApiKey,
    }),
    firebase({
        firebaseConfig: firebaseConfig, 
        auth: {
            // When deployed to Cloud Functions, Genkit will automatically use the
            // service account of the function.
            // For local development, you need to authorize the Genkit CLI with
            // a user account that has