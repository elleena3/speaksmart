// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

// ====================================================================
// 중요: 이 파일은 서버 환경에서만 사용됩니다 (예: Genkit Flows).
// 브라우저(클라이언트) 코드에서는 이 파일을 절대 import해서는 안 됩니다.
// ====================================================================

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};


if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.stack);
  }
}


const db = admin.firestore();
const storage = admin.storage();
const auth = admin.auth();

export { db, storage, auth, admin };
