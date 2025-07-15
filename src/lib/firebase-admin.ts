
// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';
import type { App } from 'firebase-admin/app';

// ====================================================================
// 중요: 이 파일은 서버 환경에서만 사용됩니다 (예: Genkit Flows).
// 브라우저(클라이언트) 코드에서는 이 파일을 절대 import해서는 안 됩니다.
// ====================================================================

let app: App;

// Firebase Admin SDK를 한 번만 초기화하도록 보장하는 함수
function initializeFirebaseAdmin(): App {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  // 서비스 계정 키 환경 변수가 있으면 해당 키를 사용하여 초기화합니다.
  if (serviceAccountString) {
    let serviceAccount;
    try {
      // 환경 변수에서 Base64로 인코딩된 JSON 문자열을 디코딩하고 파싱합니다.
      serviceAccount = JSON.parse(Buffer.from(serviceAccountString, 'base64').toString('utf-8'));
    } catch (error) {
      console.error('Could not parse FIREBASE_SERVICE_ACCOUNT_KEY. Make sure it is a valid Base64 encoded JSON string.', error);
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY.');
    }
    
    try {
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
        storageBucket: `${serviceAccount.project_id}.appspot.com`,
      });
    } catch (error: any) {
      console.error('Firebase Admin SDK initialization error with service account:', error.stack);
      throw new Error('Failed to initialize Firebase Admin SDK with service account.');
    }
  } else {
    // 환경 변수가 없을 경우, 기본 자격 증명을 사용하려고 시도합니다. (예: Google Cloud 환경)
    console.warn('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Admin SDK will try to use default credentials.');
    return admin.initializeApp();
  }
}

// 초기화 함수를 호출하여 app 인스턴스를 얻습니다.
app = initializeFirebaseAdmin();

// 초기화된 앱에서 서비스를 내보냅니다.
const db = admin.firestore(app);
const storage = admin.storage(app);
const auth = admin.auth(app);

export { db, storage, auth, admin };
