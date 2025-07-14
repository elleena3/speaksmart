
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ====================================================================
// 중요: 여기에 Firebase 프로젝트의 실제 설정 값을 직접 입력해주세요.
// Firebase 콘솔 -> 프로젝트 설정 -> 일반 탭에서 찾을 수 있습니다.
// YOUR_..._HERE 부분을 실제 값으로 교체해야 합니다.
// ====================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyCy_1qEnsU07EajtyI81nmH_NZIYYoQvP8",
  authDomain: "speaksmart-evaluator.firebaseapp.com",
  projectId: "speaksmart-evaluator",
  storageBucket: "speaksmart-evaluator.firebasestorage.app",
  messagingSenderId: "467932902885",
  appId: "1:467932902885:web:713b072c717516dea72b0c"
};


let app: FirebaseApp;

// 앱이 이미 초기화되었는지 확인하여 중복 초기화를 방지합니다.
if (!getApps().length) {
  // firebaseConfig 객체가 비어있거나 기본값 그대로인지 확인합니다.
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('YOUR_')) {
    // 유효하지 않은 설정일 경우, 초기화하지 않습니다.
    // 이 상태는 auth-context.tsx에서 감지하여 사용자에게 안내 메시지를 보여줍니다.
    console.error("Firebase config is missing or incomplete in src/lib/firebase.ts");
  } else {
    app = initializeApp(firebaseConfig);
  }
} else {
  app = getApp();
}

// app이 초기화된 경우에만 서비스를 가져옵니다.
const auth = getApps().length ? getAuth(app!) : ({} as any);
const db = getApps().length ? getFirestore(app!) : ({} as any);
const storage = getApps().length ? getStorage(app!) : ({} as any);


export { db, auth, storage, app };
