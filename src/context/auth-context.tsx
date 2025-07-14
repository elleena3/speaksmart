
// src/context/auth-context.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, firebaseConfig } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

// A fallback component to render if Firebase is not configured.
const MissingFirebaseConfig = () => (
    <div className="flex h-screen w-full items-center justify-center p-8">
        <div className="max-w-md w-full text-center bg-destructive/10 border border-destructive text-destructive p-8 rounded-lg">
            <h1 className="text-2xl font-bold mb-4">Firebase 설정 필요</h1>
            <p className="mb-2">
                Firebase 앱이 아직 설정되지 않았습니다. 앱이 정상적으로 작동하려면 설정이 필요합니다.
            </p>
            <p className="text-sm">
                <strong>해결 방법:</strong> 프로젝트의 <code>.env</code> 파일을 열고, <code>NEXT_PUBLIC_...</code> 변수에 당신의 Firebase 프로젝트 설정 값을 직접 붙여넣어 주세요.
            </p>
        </div>
    </div>
);


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Check if Firebase config is missing.
  if (!firebaseConfig.apiKey) {
    return <MissingFirebaseConfig />;
  }

  useEffect(() => {
    // auth 객체가 정의되었을 때만 리스너를 등록합니다.
    if (auth) {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          setUser(user);
          setLoading(false);
        });
        return () => unsubscribe();
    } else {
        // auth가 없으면 로딩을 중단합니다. (오류 메시지가 표시됩니다)
        setLoading(false);
    }
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
