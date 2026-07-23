'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import type { AnalyzeHandwritingSubmissionOutput } from '@/ai/flows/analyze-handwriting-submission-flow';
import crypto from 'crypto';

function generateDocId(fileName: string) {
    // Generate a safe document ID from the file name using SHA256
    return crypto.createHash('sha256').update(fileName).digest('hex');
}

export async function checkGradingHistoryBatch(fileNames: string[]): Promise<string[]> {
    try {
        const db = getAdminDb();
        const foundFiles: string[] = [];
        for (const f of fileNames) {
            const docId = generateDocId(f);
            const snap = await db.collection('handwriting_gradings').doc(docId).get();
            if (snap.exists) foundFiles.push(f);
        }
        return foundFiles;
    } catch {
        return [];
    }
}

export async function getPreviousGradingResult(fileName: string): Promise<string | null> {
    try {
        const db = getAdminDb();
        const docId = generateDocId(fileName);

        const docRef = db.collection('handwriting_gradings').doc(docId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            if (data) {
                return `[과거 학생 표본 자동 검색됨] 파일: ${data.fileName}, 과거 점수: ${data.score}, 과거 산출근거: ${data.scoringDetails}, 과거 피드백 요약: ${data.studentFeedback.slice(0, 300)}...`;
            }
        }
        return null;
    } catch (e) {
        console.error("Error retrieving grading history from DB:", e);
        return null; // Fail gracefully so it doesn't break the UI
    }
}

export async function saveGradingResult(fileName: string, result: AnalyzeHandwritingSubmissionOutput) {
    try {
        const db = getAdminDb();
        const docId = generateDocId(fileName);

        const docRef = db.collection('handwriting_gradings').doc(docId);
        await docRef.set({
            fileName,
            score: result.score || null,
            scoringDetails: result.scoringDetails || '',
            studentFeedback: result.studentFeedback || '',
            teacherGuidance: result.teacherGuidance || '',
            updatedAt: new Date().toISOString()
        });
    } catch (e) {
        console.error("Error saving grading history to DB:", e);
        // Fail gracefully
    }
}
