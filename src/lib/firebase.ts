
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ====================================================================
// 중요: 새 Firebase 프로젝트의 설정 값으로 이 부분을 교체해야 합니다.
// Firebase 콘솔의 '프로젝트 설정'에서 값을 복사하여 붙여넣으세요.
// ====================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyAX4QXJaFvRGm0pLLk8n6PdFW5bY_QkJNg",
  authDomain: "speaksmart-evaluator.firebaseapp.com",
  projectId: "speaksmart-evaluator",
  storageBucket: "speaksmart-evaluator.appspot.com",
  messagingSenderId: "467932902885",
  appId: "1:467932902885:web:389f9b929bb5cd1aa72b0c"
};


let app: FirebaseApp;

// 앱이 이미 초기화되었는지 확인하여 중복 초기화를 방지합니다.
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// app이 초기화된 경우에만 서비스를 가져옵니다.
const auth = getApps().length ? getAuth(app!) : ({} as any);
const db = getApps().length ? getFirestore(app!) : ({} as any);
const storage = getApps().length ? getStorage(app!) : ({} as any);


export { db, auth, storage, app };
