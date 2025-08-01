import {genkit, type Plugin} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import openai from 'genkitx-openai';
import {config} from 'dotenv';

config();

const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const plugins: Plugin[] = [];

if (GOOGLE_CLOUD_PROJECT && GOOGLE_CLOUD_LOCATION) {
    plugins.push(googleAI({
      vertex: {
        project: GOOGLE_CLOUD_PROJECT,
        location: GOOGLE_CLOUD_LOCATION,
      },
    }));
} else {
    console.warn(
      'Google Cloud (Vertex AI) environment variables not set. Google AI models will not be available.'
    );
}

if (OPENAI_API_KEY) {
    plugins.push(openai({
        apiKey: OPENAI_API_KEY,
    }));
} else {
    console.warn('OPENAI_API_KEY not set. OpenAI models will not be available.');
}

if (plugins.length === 0) {
    console.error("CRITICAL: No AI model providers have been configured. The application will not work as expected.");
}


export const ai = genkit({
  plugins: plugins,
});
