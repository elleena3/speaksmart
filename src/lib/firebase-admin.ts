
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
  // 이미 앱이 초기화되었다면, 기존 앱을 반환합니다.
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // App Hosting 환경에서는 자동으로 서비스 계정을 찾아 사용합니다.
  // 추가 설정 없이 initializeApp()을 호출하는 것이 가장 안정적입니다.
  try {
    return admin.initializeApp();
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.stack);
    // 초기화 실패 시 더 구체적인 오류를 던져서 디버깅을 돕습니다.
    throw new Error('Failed to initialize Firebase Admin SDK. Please ensure the App Hosting environment is correctly set up with service account permissions.');
  }
}

// 초기화 함수를 호출하여 app 인스턴스를 얻습니다.
app = initializeFirebaseAdmin();

// 초기화된 앱에서 서비스를 내보냅니다.
const db = admin.firestore(app);
const storage = admin.storage(app);
const auth = admin.auth(app);

export { db, storage, auth, admin };
