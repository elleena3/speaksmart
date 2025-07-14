// src/context/auth-context.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, firebaseConfig } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

// A fallback component to render if Firebase is not configured.
const MissingFirebaseConfig = () => (
    <div className="flex h-screen w-full items-center justify-center p-8">
        <div className="max-w-md w-full text-center bg-destructive/10 border border-destructive text-destructive p-8 rounded-lg">
            <h1 className="text-2xl font-bold mb-4">Firebase 설정이 필요합니다</h1>
            <p className="mb-2">
                앱이 Firebase에 연결되지 않았습니다. 계속하려면 설정을 완료해야 합니다.
            </p>
            <p className="text-sm">
                <strong>해결 방법:</strong> 프로젝트의 <code>src/lib/firebase.ts</code> 파일을 열고, <code>firebaseConfig</code> 객체 안의 <code>YOUR_..._HERE</code> 값을 당신의 실제 Firebase 프로젝트 키로 교체해주세요.
            </p>
        </div>
    </div>
);


interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Check if Firebase config is missing.
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_")) {
    return <MissingFirebaseConfig />;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
