import WebSocket from 'ws';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
const HOST = "generativelanguage.googleapis.com";
const url = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${key}`;

const ws = new WebSocket(url);
ws.on('open', () => {
    const setup = {
        setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
                }
            }
        }
    };
    ws.send(JSON.stringify(setup));
});
ws.on('message', async (data) => {
    console.log("Message received:", typeof data, data instanceof Buffer ? data.toString() : data);
});
ws.on('error', (err) => console.error("Error:", err));
ws.on('close', (code, reason) => console.log("Closed:", code, String(reason)));
setTimeout(() => process.exit(0), 3000);
