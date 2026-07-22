import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
async function run() {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1alpha/models?key=${key}`);
    const data = await res.json();
    console.log("Checking all models for bidiGenerateContent support...");
    for (const model of data.models) {
        if (model.supportedGenerationMethods && model.supportedGenerationMethods.includes("bidiGenerateContent")) {
            console.log("FOUND SUPPORT:", model.name);
        }
    }
}
run();
