
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ====================================================================
// 중요: 새 Firebase 프로젝트의 설정 값으로 이 부분을 교체해야 합니다.
// 아래 값들은 문제가 발생했던 이전 프로젝트의 설정입니다.
// ====================================================================
export const firebaseConfig = {
  apiKey: "YOUR_NEW_API_KEY",
  authDomain: "YOUR_NEW_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_NEW_PROJECT_ID",
  storageBucket: "YOUR_NEW_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_NEW_MESSAGING_SENDER_ID",
  appId: "YOUR_NEW_APP_ID"
};


let app: FirebaseApp;

// 앱이 이미 초기화되었는지 확인하여 중복 초기화를 방지합니다.
if (!getApps().length) {
  // firebaseConfig 객체가 비어있거나 기본값 그대로인지 확인합니다.
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('YOUR_')) {
    // 유효하지 않은 설정일 경우, 초기화하지 않습니다.
    // 이 상태는 auth-context.tsx에서 감지하여 사용자에게 안내 메시지를 보여줍니다.
    console.error("Firebase config is missing or incomplete in src/lib/firebase.ts. Please add your new project's configuration.");
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
