
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// =================================================================
// 아래 'YOUR_..._HERE' 부분을 실제 Firebase 프로젝트 값으로 교체해주세요.
// 예: apiKey: "AIzaSy...XYZ"
// 모든 값을 정확히 입력해야 앱이 작동합니다.
// =================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyCy_lqEnsU07EajtyI8lnmH_NZIYYoQvP8",
  authDomain: "speaksmart-evaluator.firebaseapp.com",
  projectId: "speaksmart-evaluator",
  storageBucket: "speaksmart-evaluator.appspot.com",
  messagingSenderId: "467932902885",
  appId: "1:467932902885:web:389f9b929bb5cd1aa72b0c"
};


let app: FirebaseApp;

// 앱이 이미 초기화되었는지 확인하여 중복 초기화를 방지합니다.
if (!getApps().length) {
  // firebaseConfig 객체가 비어있지 않은지 확인
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('YOUR_')) {
    app = initializeApp(firebaseConfig);
  } else {
    // 이 console.error는 서버 측에서 보일 수 있습니다.
    console.error("Firebase 설정이 src/lib/firebase.ts 파일에 필요합니다. 모든 'YOUR_..._HERE' 값을 실제 키로 교체해주세요.");
    // 클라이언트 측에서 처리할 수 있도록 빈 앱을 반환하거나, 에러를 던질 수 있지만
    // AuthProvider에서 이 문제를 처리하므로 여기서는 경고만 남깁니다.
  }
} else {
  app = getApp();
}

// app이 초기화된 경우에만 auth, db, storage를 가져옵니다.
const auth = getAuth(app!);
const db = getFirestore(app!);
const storage = getStorage(app!);

export { db, auth, storage, app };
