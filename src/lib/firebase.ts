
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
  apiKey: "여기에_붙여넣기",
  authDomain: "여기에_붙여넣기",
  projectId: "여기에_붙여넣기",
  storageBucket: "여기에_붙여넣기",
  messagingSenderId: "여기에_붙여넣기",
  appId: "여기에_붙여넣기",
  measurementId: "여기에_붙여넣기"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

// 모든 필수 환경 변수가 설정되었는지 확인합니다.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId || firebaseConfig.apiKey === "여기에_붙여넣기") {
  console.error(
    "Firebase 설정이 src/lib/firebase.ts 파일에 올바르게 구성되지 않았습니다. Firebase 콘솔에서 값을 복사하여 붙여넣어주세요."
  );
} else {
    try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
    } catch (e) {
        console.error("Firebase initialization error:", e);
    }
}


export { app, db, auth, storage };
