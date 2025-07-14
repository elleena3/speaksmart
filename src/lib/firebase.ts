
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ====================================================================
// 중요: 새로 만든 Firebase 프로젝트의 설정을 아래에 붙여넣어 주세요.
//
// 1. [Firebase 콘솔](https://console.firebase.google.com/)로 이동합니다.
// 2. 새로 만드신 프로젝트를 선택합니다.
// 3. 왼쪽 상단의 톱니바퀴 아이콘(⚙️)을 눌러 '프로젝트 설정'으로 이동합니다.
// 4. '내 앱' 섹션에서 '웹 앱'을 선택하거나, 없다면 </> 아이콘을 눌러 새로 만듭니다.
// 5. 'SDK 설정 및 구성' 에서 '구성(Config)' 옵션을 선택하면 아래와 같은 코드가 보입니다.
// 6. 그 코드의 `apiKey`부터 `appId`까지의 내용을 아래 `firebaseConfig`에 그대로 복사해서 붙여넣으세요.
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
