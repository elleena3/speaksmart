// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

// ====================================================================
// 중요: 이 파일은 서버 환경에서만 사용됩니다 (예: Genkit Flows).
// 브라우저(클라이언트) 코드에서는 이 파일을 절대 import해서는 안 됩니다.
// ====================================================================

// 서비스 계정 키를 환경 변수에서 읽어옵니다.
// VITE_FIREBASE_SERVICE_ACCOUNT_KEY는 JSON 문자열 형태여야 합니다.
const serviceAccountString = process.env.VITE_FIREBASE_SERVICE_ACCOUNT_KEY;

let serviceAccount;
if (serviceAccountString) {
  try {
    serviceAccount = JSON.parse(serviceAccountString);
  } catch (error) {
    console.error('Error parsing Firebase service account key JSON:', error);
  }
}

const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};


if (!admin.apps.length) {
  try {
    // 서비스 계정 키가 있으면 해당 키로 초기화하고, 없으면 기본 방식을 시도합니다.
    admin.initializeApp({
      credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
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
