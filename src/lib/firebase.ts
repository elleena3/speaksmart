// src/lib/firebase.ts

// ====================================================================
// 중요: 새로 만드신 Firebase 프로젝트의 설정 정보를 여기에 붙여넣어 주세요.
//
// 1. Firebase 콘솔(https://console.firebase.google.com/)로 이동합니다.
// 2. 새로 만드신 프로젝트를 선택합니다.
// 3. 왼쪽 메뉴에서 톱니바퀴 아이콘(⚙️) > '프로젝트 설정'을 클릭합니다.
// 4. '내 앱' 섹션에서 웹 앱(</>)을 아직 만들지 않았다면 새로 생성합니다.
// 5. 앱을 선택한 후 'SDK 설정 및 구성'에서 '구성(Config)' 옵션을 선택합니다.
// 6. 아래 `firebaseConfig` 객체 전체를 복사한 코드로 교체해 주세요.
// ====================================================================

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:a1b2c3d4e5f6g7h8i9j0",
  measurementId: "G-XXXXXXXXXX"
};


// Firebase 앱 초기화
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
