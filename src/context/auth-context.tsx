
// src/context/auth-context.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

// firebaseConfig가 비어있을 때 표시될 컴포넌트
const MissingFirebaseConfig = () => (
    <div className="flex h-screen w-full items-center justify-center p-8">
        <div className="max-w-md w-full text-center bg-destructive/10 border border-destructive text-destructive p-8 rounded-lg">
            <h1 className="text-2xl font-bold mb-4">Firebase 설정이 필요합니다</h1>
            <p className="mb-2">
                앱이 Firebase에 연결되지 않았습니다. 계속하려면 설정을 완료해야 합니다.
            </p>
            <p className="text-sm">
                <strong>해결 방법:</strong> 프로젝트 루트의 <code>.env</code> 파일에 Firebase 프로젝트의 키를 올바르게 입력했는지 확인해주세요. 모든 변수는 <code>NEXT_PUBLIC_</code>으로 시작해야 합니다.
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
  const [configValid, setConfigValid] = useState(true);

  useEffect(() => {
    // 환경 변수가 제대로 로드되었는지 확인합니다.
    const isConfigValid = process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY.includes('YOUR_');
    setConfigValid(isConfigValid);

    if (isConfigValid) {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          setUser(user);
          setLoading(false);
        });
        return () => unsubscribe();
    } else {
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

  if (!configValid) {
    return <MissingFirebaseConfig />;
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
