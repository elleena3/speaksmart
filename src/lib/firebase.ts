
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, type Analytics, isSupported } from "firebase/analytics";

export const firebaseConfig = {
  apiKey: "AIzaSyAieUKTGnuh0f9zWJYjgYM77j4mEshxWCg",
  authDomain: "speaksmart-evaluator2.firebaseapp.com",
  projectId: "speaksmart-evaluator2",
  storageBucket: "speaksmart-evaluator2.appspot.com",
  messagingSenderId: "60227542963",
  appId: "1:60227542963:web:f5d6c51046eb572a9c35c6",
  measurementId: "G-M20FDF494Y"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let analytics: Analytics | undefined;

try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    if (typeof window !== 'undefined') {
        isSupported().then((supported) => {
            if (supported) {
                analytics = getAnalytics(app);
            }
        });
    }
} catch (e) {
    console.error("Firebase initialization error:", e);
}

export { app, db, auth, storage, analytics };
