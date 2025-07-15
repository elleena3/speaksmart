
// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

// ====================================================================
// 중요: 이 파일은 서버 환경에서만 사용됩니다 (예: Genkit Flows).
// 브라우저(클라이언트) 코드에서는 이 파일을 절대 import해서는 안 됩니다.
// ====================================================================

// Firebase Admin SDK를 한 번만 초기화하도록 보장하는 함수
function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountString = process.env.VITE_FIREBASE_SERVICE_ACCOUNT_KEY;
  let serviceAccount;

  if (serviceAccountString) {
    try {
      serviceAccount = JSON.parse(serviceAccountString);
    } catch (error) {
      console.error('Error parsing Firebase service account key JSON:', error);
    }
  } else {
    console.warn('VITE_FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Admin SDK will try to use default credentials.');
  }

  const firebaseConfig = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  };
  
  try {
    return admin.initializeApp({
      credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
    });
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.stack);
    // 초기화 실패 시 프로세스를 중단하거나 적절한 오류 처리를 수행할 수 있습니다.
    throw new Error('Failed to initialize Firebase Admin SDK.');
  }
}

// 초기화 함수를 호출하여 app 인스턴스를 얻습니다.
const app = initializeFirebaseAdmin();

// 초기화된 앱에서 서비스를 내보냅니다.
const db = admin.firestore(app);
const storage = admin.storage(app);
const auth = admin.auth(app);

export { db, storage, auth, admin };
