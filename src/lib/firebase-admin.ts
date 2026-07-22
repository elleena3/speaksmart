// src/lib/firebase-admin.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

// IMPORTANT: This file is for server-side (Genkit flows, API routes) use only.
// It uses the service account credentials to gain admin privileges.
// DO NOT import or use this file in client-side components.

// ====================================================================
// ## 서비스 계정 설정 가이드 ##
//
// 1. Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 탭으로 이동합니다.
// 2. '새 비공개 키 생성' 버튼을 클릭하여 서비스 계정 키(.json) 파일을 다운로드합니다.
// 3. 다운로드한 .json 파일의 내용을 복사합니다.
// 4. 이 프로젝트의 루트 경로에 있는 .env 파일에 다음 형식으로 붙여넣습니다:
//    FIREBASE_SERVICE_ACCOUNT_KEY='{"type": "service_account", "project_id": "...", ...}'
//
// 이렇게 설정하면, 아래 코드가 환경 변수를 읽어 서버를 안전하게 인증합니다.
// 로컬 개발 환경과 배포 환경(예: Vercel, App Hosting) 모두에서 이 환경 변수 설정이 필요합니다.
// ====================================================================

function getAdminApp(): App {
  if (getApps().some(app => app.name === 'admin')) {
    return getApps().find(app => app.name === 'admin')!;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set in the environment variables. " +
      "This is required for server-side Firebase Admin operations like Storage access. " +
      "Please check the setup guide in 'src/lib/firebase-admin.ts'."
    );
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    return initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    }, 'admin');
  } catch (error) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Make sure it's a valid JSON string.", error);
    throw new Error("Could not initialize Firebase Admin SDK. The service account key is invalid.");
  }
}

// Export getter functions instead of static constants to ensure Lazy Initialization.
// This prevents Next.js / Webpack from crashing the entire server chunk if the env var is missing
// but the user only wants to execute a completely different Server Action.

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminStorage() {
  return getStorage(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}