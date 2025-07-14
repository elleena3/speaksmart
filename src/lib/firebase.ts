
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// =================================================================
// .env 파일의 변수들을 사용하여 Firebase 설정을 구성합니다.
// Next.js에서 클라이언트 측에 변수를 노출시키려면
// 반드시 'NEXT_PUBLIC_' 접두사를 사용해야 합니다.
// =================================================================
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};
// =================================================================

let app: FirebaseApp;

// 앱이 이미 초기화되었는지 확인하여 중복 초기화를 방지합니다.
if (!getApps().length) {
    // 설정값이 모두 있는지 확인합니다.
    if (firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
    } else {
        // 이 메시지는 AuthProvider에서 사용자에게 표시될 것입니다.
        console.error("Firebase 설정이 .env 파일에 필요합니다.");
    }
} else {
    app = getApp();
}

// @ts-ignore
const auth = app ? getAuth(app) : undefined;
// @ts-ignore
const db = app ? getFirestore(app) : undefined;
// @ts-ignore
const storage = app ? getStorage(app) : undefined;

export { db, auth, storage, app, firebaseConfig };
