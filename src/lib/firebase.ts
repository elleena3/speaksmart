
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
  apiKey: "새 Firebase 프로젝트의 API 키를 여기에 붙여넣으세요",
  authDomain: "새-프로젝트-ID.firebaseapp.com",
  projectId: "새-프로젝트-ID",
  storageBucket: "새-프로젝트-ID.appspot.com",
  messagingSenderId: "새 숫자 메시징 발신자 ID",
  appId: "새 앱 ID"
};


let app: FirebaseApp;

// 앱이 이미 초기화되었는지 확인하여 중복 초기화를 방지합니다.
if (!getApps().length) {
  // firebaseConfig 객체가 비어있거나 기본값 그대로인지 확인합니다.
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('여기에')) {
    // 유효하지 않은 설정일 경우, 초기화하지 않습니다.
    // 이 상태는 auth-context.tsx에서 감지하여 사용자에게 안내 메시지를 보여줍니다.
    console.error("Firebase 설정이 비어있거나 미완성입니다. src/lib/firebase.ts 파일에 새 프로젝트의 설정을 추가해주세요.");
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
