// src/lib/firebase-client.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, type Analytics, isSupported } from "firebase/analytics";

// This file is for CLIENT-SIDE use only.

const firebaseConfig = {
  apiKey: "AIzaSyAieUKTGnuh0f9zWJYjgYM77j4mEshxWCg",
  authDomain: "speaksmart-evaluator2.firebaseapp.com",
  projectId: "speaksmart-evaluator2",
  storageBucket: "speaksmart-evaluator2.appspot.com",
  messagingSenderId: "60227542963",
  appId: "1:60227542963:web:f5d6c51046eb572a9c35c6",
  measurementId: "G-M20FDF494Y"
};


// Firebase 앱 초기화
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let analytics: Analytics | undefined;

if (typeof window !== 'undefined') {
    if (!getApps().length) {
        try {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
            storage = getStorage(app);
            isSupported().then((supported) => {
                if (supported) {
                    analytics = getAnalytics(app);
                }
            });
        } catch(e) {
            console.error("Firebase initialization error:", e);
        }
    } else {
        app = getApp();
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        isSupported().then((supported) => {
            if (supported) {
                analytics = getAnalytics(app);
            }
        });
    }
}

// Ensure exports are available for server-side rendering even if initialization is skipped
// @ts-ignore
if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    // @ts-ignore
    auth = getAuth(app);
    // @ts-ignore
    db = getFirestore(app);
    // @ts-ignore
    storage = getStorage(app);
}

export { app, auth, db, storage, analytics };
