import * as functions from 'firebase-functions';
import { ai } from '../src/ai/genkit';

export const chat = functions
  .region('asia-northeast3')
  .https.onRequest(async (req, res) => {
    const prompt = req.body.prompt ?? '';
    const model  = req.body.model  ?? 'gpt-4o-preview';
    const out    = await ai.generate({ prompt, model });
    res.json({ text: out.text });
  });