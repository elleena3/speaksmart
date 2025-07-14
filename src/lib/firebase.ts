// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import getConfig from 'next/config';

// next.config.js에서 publicRuntimeConfig를 가져옵니다.
const { publicRuntimeConfig } = getConfig() || {};
const {
  firebaseApiKey,
  firebaseAuthDomain,
  firebaseProjectId,
  firebaseStorageBucket,
  firebaseMessagingSenderId,
  firebaseAppId,
} = publicRuntimeConfig || {};


// Firebase 구성 객체
const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: firebaseAuthDomain,
  projectId: firebaseProjectId,
  storageBucket: firebaseStorageBucket,
  messagingSenderId: firebaseMessagingSenderId,
  appId: firebaseAppId,
};

// apiKey가 있는지 확인하여 오류를 방지합니다.
if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is missing. Check your .env file and next.config.js");
}


// Firebase 초기화
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage, app };
