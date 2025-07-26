
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
  apiKey: "AIzaSyAieUKTGnuh0f9zWJYjgYM77j4mEshxWCg",
  authDomain: "speaksmart-evaluator2.firebaseapp.com",
  projectId: "speaksmart-evaluator2",
  storageBucket: "speaksmart-evaluator2.appspot.com",
  messagingSenderId: "60227542963",
  appId: "1:60227542963:web:f5d6c51046eb572a9c35c6",
  measurementId: "G-M20FDF494Y",
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
