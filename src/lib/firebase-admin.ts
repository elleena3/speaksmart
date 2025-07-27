// src/lib/firebase-admin.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

// IMPORTANT: This file is for server-side (Genkit flows, API routes) use only.
// It uses the service account credentials to gain admin privileges.
// DO NOT import or use this file in client-side components.

// The service account key is securely managed by Firebase App Hosting environment.
// No need to manually set GOOGLE_APPLICATION_CREDENTIALS.
const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;

let adminApp: App;

if (!getApps().some(app => app.name === 'admin')) {
  adminApp = initializeApp({
    // Credential is automatically handled by the App Hosting environment
    // credential: cert(serviceAccount), 
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  }, 'admin');
} else {
  adminApp = getApps().find(app => app.name === 'admin')!;
}

const adminDb = getFirestore(adminApp);
const adminStorage = getStorage(adminApp);
const adminAuth = getAuth(adminApp);

export { adminDb, adminStorage, adminAuth };
