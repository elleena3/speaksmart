import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {firebase} from '@genkit-ai/firebase';
import { firebaseConfig } from '@/lib/firebase'; // Import from the single source of truth

// Hardcoded Google AI API Key to prevent build issues.
const GOOGLE_API_KEY = "AIzaSyAieUKTGnuh0f9zWJYjgYM77j4mEshxWCg";

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GOOGLE_API_KEY,
    }),
    firebase({
        firebaseConfig: firebaseConfig, // Use the same config object
        auth: {
            // When deployed to Cloud Functions, Genkit will automatically use the
            // service account of the function.
            // For local development, you need to authorize the Genkit CLI with
            // a user account that has access to the project.
        },
    }),
  ],
});
