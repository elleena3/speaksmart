import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
async function run() {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp?key=${key}`);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));

    const res2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=${key}`);
    const data2 = await res2.json();
    console.log(JSON.stringify(data2.supportedGenerationMethods, null, 2));
}
run();
