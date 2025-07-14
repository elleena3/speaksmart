
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// =================================================================
// 중요: 아래에 Firebase 설정 값을 직접 붙여넣어 주세요.
// .env 파일이 작동하지 않으므로, 이 방법으로 문제를 해결합니다.
//
// Firebase 콘솔 -> 프로젝트 설정 -> 일반 탭에서 'SDK 설정 및 구성'을 찾아
// '구성'을 선택하면 아래와 같은 객체를 찾을 수 있습니다.
//
// 예시:
//   apiKey: "AIzaSy...",
//   authDomain: "your-project.firebaseapp.com",
//   ...
// =================================================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_AUTH_DOMAIN_HERE",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
};
// =================================================================

let app: FirebaseApp;

// 앱이 이미 초기화되었는지 확인합니다. (중복 초기화 방지)
if (!getApps().length) {
    // apiKey 값이 placeholder가 아닌지 확인합니다.
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
        app = initializeApp(firebaseConfig);
    } else {
        console.error("Firebase 설정이 src/lib/firebase.ts 파일에 필요합니다.");
        // 앱을 초기화하지 않고, AuthProvider에서 사용자에게 메시지를 보여줍니다.
    }
} else {
    app = getApp();
}

// 초기화가 성공했을 때만 auth, db, storage를 가져옵니다.
const auth = app! ? getAuth(app) : undefined;
const db = app! ? getFirestore(app) : undefined;
const storage = app! ? getStorage(app) : undefined;

export { db, auth, storage, app, firebaseConfig };
