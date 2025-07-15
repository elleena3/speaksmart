
// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';
import type { App, AppOptions } from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type { Storage } from 'firebase-admin/storage';

// ====================================================================
// 중요: 이 파일은 서버 환경에서만 사용됩니다 (예: Genkit Flows).
// 브라우저(클라이언트) 코드에서는 이 파일을 절대 import해서는 안 됩니다.
// ====================================================================

let app: App | undefined;
let firestore: Firestore | undefined;
let authAdmin: Auth | undefined;
let storageAdmin: Storage | undefined;

function initializeAppWithOptions(): void {
  // 이미 초기화되었다면, 아무것도 하지 않습니다.
  if (admin.apps.length > 0 && admin.apps[0]) {
    app = admin.apps[0];
  } else {
    // App Hosting 환경에서는 자동으로 서비스 계정을 찾아 사용합니다.
    // 추가 설정 없이 initializeApp()을 호출하는 것이 가장 안정적입니다.
    try {
      app = admin.initializeApp();
    } catch (error) {
      console.error('Firebase Admin SDK initialization error:', error);
      throw new Error('Failed to initialize Firebase Admin SDK. Please ensure the App Hosting environment is correctly set up with service account permissions.');
    }
  }

  // 초기화된 앱에서 서비스들을 할당합니다.
  firestore = admin.firestore(app);
  authAdmin = admin.auth(app);
  storageAdmin = admin.storage(app);
}

// 앱이 시작될 때 단 한 번만 초기화 함수를 호출합니다.
initializeAppWithOptions();

// 실제로 사용할 때는 이 객체들을 import 합니다.
// 예: import { db } from '@/lib/firebase-admin'
export const db = firestore!;
export const auth = authAdmin!;
export const storage = storageAdmin!;
export { admin };
