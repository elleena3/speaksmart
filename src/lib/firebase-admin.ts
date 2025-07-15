
// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';
import type { App } from 'firebase-admin/app';
import { firebaseConfig } from './firebase'; // 클라이언트 설정을 가져옵니다.

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

  // 환경 변수 대신, 클라이언트 설정에서 프로젝트 ID와 스토리지 버킷을 사용합니다.
  // 이 방식은 Firebase Hosting이나 Cloud Functions 같은 Google 환경에서
  // 자동으로 인증 정보를 찾아 초기화합니다.
  try {
    return admin.initializeApp({
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      // 이 환경에서는 credential을 명시적으로 제공할 필요가 없습니다.
      // App Hosting 환경이 자동으로 서비스 계정을 찾아 사용합니다.
    });
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.stack);
    throw new Error('Failed to initialize Firebase Admin SDK. Please check project configurations.');
  }
}

// 초기화 함수를 호출하여 app 인스턴스를 얻습니다.
app = initializeFirebaseAdmin();

// 초기화된 앱에서 서비스를 내보냅니다.
const db = admin.firestore(app);
const storage = admin.storage(app);
const auth = admin.auth(app);

export { db, storage, auth, admin };
