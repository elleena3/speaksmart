import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// IMPORTANT: Replace this with your actual server-side API key.
// This key should have NO website restrictions.
const GOOGLE_API_KEY = "YOUR_SERVER_API_KEY_HERE";

if (!GOOGLE_API_KEY || GOOGLE_API_KEY === "YOUR_SERVER_API_KEY_HERE") {
    console.warn("Google AI API Key is not configured in src/ai/genkit.ts. AI features will not work.");
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GOOGLE_API_KEY
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});
