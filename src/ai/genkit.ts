import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {firebase} from '@genkit-ai/firebase';
import { firebaseConfig } from '@/lib/firebase'; // Import from the single source of truth

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_API_KEY,
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
