
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ====================================================================
// 중요: 새로 만든 Firebase 프로젝트의 설정을 아래에 붙여넣어 주세요.
// Firebase 콘솔 > 프로젝트 설정 (톱니바퀴 아이콘) > 일반 탭 > '내 앱' 섹션에서 찾을 수 있습니다.
//
// 1. 아래의 placeholder 값들을 실제 프로젝트 값으로 교체하세요.
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
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);


export { db, auth, storage, app };
