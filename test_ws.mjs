import WebSocket from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
const HOST = "generativelanguage.googleapis.com";
const url = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${key}`;

const ws = new WebSocket(url);
ws.on('open', () => {
    console.log("Connected");
    ws.send(JSON.stringify({
        setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generationConfig: { responseModalities: ["AUDIO"] }
        }
    }));
});
let gotComplete = false;
ws.on('message', (data) => {
    const raw = String(data);
    const obj = JSON.parse(raw);
    if (obj.setupComplete) {
        console.log("Setup complete, sending Hello");
        ws.send(JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text: "Hello! Tell me a long story about a dog." }] }], turnComplete: true } }));
    }
    if (obj.serverContent?.modelTurn) {
        for (let part of obj.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
                const buf = Buffer.from(part.inlineData.data, 'base64');
                console.log("Got audio buffer of length:", buf.length);
                fs.appendFileSync('out.pcm', buf);
            }
        }
    }
    if (obj.serverContent?.turnComplete) {
        console.log("Turn complete");
        process.exit(0);
    }
});
