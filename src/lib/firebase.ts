
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// ====================================================================
// Firebase 설정 안내
//
// 1. Firebase 콘솔(console.firebase.google.com)로 이동하여 프로젝트를 선택합니다.
// 2. 왼쪽 상단의 톱니바퀴 아이콘(⚙️)을 클릭 > '프로젝트 설정'으로 이동합니다.
// 3. '내 앱' 카드에서 웹 앱을 선택합니다.
// 4. 'Firebase SDK 스니펫' 섹션에서 '구성(Config)'을 선택하면 필요한 모든 값을 확인할 수 있습니다.
// 5. 아래 firebaseConfig 객체에 해당 값들을 직접 붙여넣어 주세요.
//
// 참고: 이 방식은 환경 변수(.env) 설정 문제를 해결하기 위한 가장 확실한 방법입니다.
// ====================================================================
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // 여기에 API 키를 입력하세요.
  authDomain: "YOUR_AUTH_DOMAIN", // 여기에 인증 도메인을 입력하세요.
  projectId: "YOUR_PROJECT_ID", // 여기에 프로젝트 ID를 입력하세요.
  storageBucket: "YOUR_STORAGE_BUCKET", // 여기에 스토리지 버킷을 입력하세요.
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // 여기에 메시징 발신자 ID를 입력하세요.
  appId: "YOUR_APP_ID", // 여기에 앱 ID를 입력하세요.
  measurementId: "YOUR_MEASUREMENT_ID", // 여기에 측정 ID를 입력하세요 (선택 사항).
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
} catch (e) {
    console.error("Firebase initialization error. Check your firebaseConfig in src/lib/firebase.ts", e);
}

export { app, db, auth, storage };
