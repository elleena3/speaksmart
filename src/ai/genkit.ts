
'use server';

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {firebase} from '@genkit-ai/firebase';
import { firebaseConfig } from '@/lib/firebase'; 

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.warn(
      'GOOGLE_API_KEY is not set. AI features might not work in the local dev environment.'
    );
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GOOGLE_API_KEY,
    }),
    firebase({
        firebaseConfig: firebaseConfig, 
        auth: {
            // When deployed to Cloud Functions, Genkit will automatically use the
            // service account of the function.
            // For local development, you need to authorize the Genkit CLI with
            // a user account that has firebase.projects.get auth permission.
            // Run `genkit auth login` to do so.
            // See: https://firebase.google.com/docs/genkit/plugins/firebase#authentication
        }
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
