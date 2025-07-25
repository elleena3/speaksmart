// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ====================================================================
// Firebase 설정 안내
//
// 아래 값들은 Firebase 콘솔에서 찾을 수 있습니다.
// 1. Firebase 콘솔(console.firebase.google.com)로 이동하여 프로젝트를 선택합니다.
// 2. 왼쪽 상단의 톱니바퀴 아이콘(⚙️)을 클릭 > '프로젝트 설정'으로 이동합니다.
// 3. '내 앱' 카드에서 웹 앱을 선택합니다.
// 4. 'Firebase SDK 스니펫' 섹션에서 '구성(Config)'을 선택하면 필요한 모든 값을 확인할 수 있습니다.
//
// 찾은 값들을 이 프로젝트의 루트에 있는 .env 파일에 복사하여 붙여넣으세요.
// ====================================================================
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "speaksmart-evaluator.firebaseapp.com",
  projectId: "speaksmart-evaluator",
  storageBucket: "speaksmart-evaluator.appspot.com",
  messagingSenderId: "1057027581793",
  appId: "1:1057027581793:web:723a95133e02835e076321",
  measurementId: "G-J6E3E2L17P"
};

// 모든 필수 환경 변수가 설정되었는지 확인합니다.
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
  console.error(
    "Firebase API 키가 설정되지 않았습니다. src/lib/firebase.ts 파일의 firebaseConfig 객체를 확인해주세요."
  );
}

// Firebase 앱 초기화
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
