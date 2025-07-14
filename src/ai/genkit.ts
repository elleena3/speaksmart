import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';
config();

// IMPORTANT: The API key is now managed via Google Cloud Console.
// Ensure the "Browser key (auto created by Firebase)" has Application restrictions set to "None"
// and API restrictions set to "Generative Language API".
const GOOGLE_API_KEY = process.env.GOOGLE_GENAI_API_KEY;

if (!GOOGLE_API_KEY) {
    console.warn("Google AI API Key is not configured. AI features might not work.");
    console.warn("Please ensure you have a .env file with GOOGLE_GENAI_API_KEY set, or that the key is available in your deployment environment.");
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GOOGLE_API_KEY
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});
