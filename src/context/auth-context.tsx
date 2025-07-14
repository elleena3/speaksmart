
// src/context/auth-context.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, firebaseConfig } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

// firebaseConfig가 비어있을 때 표시될 컴포넌트
const MissingFirebaseConfig = () => (
    <div className="flex h-screen w-full items-center justify-center p-8 bg-background">
        <div className="max-w-lg w-full text-center bg-card border border-destructive text-foreground p-8 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold mb-4 text-destructive">Firebase 설정이 필요합니다</h1>
            <p className="mb-4">
                앱이 Firebase에 연결되지 않았습니다. 계속하려면 설정을 완료해야 합니다.
            </p>
            <div className="text-left bg-muted p-4 rounded-md text-sm space-y-2">
                <p><strong>해결 방법:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                    <li><strong className="text-primary">Firebase 콘솔</strong>에서 웹 앱의 설정 정보를 복사하세요.</li>
                    <li>편집기에서 <code className="font-mono bg-secondary px-1 py-0.5 rounded">src/lib/firebase.ts</code> 파일을 여세요.</li>
                    <li>파일 상단의 <code className="font-mono bg-secondary px-1 py-0.5 rounded">firebaseConfig</code> 객체에 복사한 값들을 붙여넣으세요.</li>
                </ol>
            </div>
             <p className="text-xs text-muted-foreground mt-4">
                모든 "YOUR_..._HERE" 부분을 실제 값으로 교체해야 합니다.
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
  
  // firebaseConfig가 유효한지 확인합니다.
  const isConfigValid = firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('YOUR_');

  useEffect(() => {
    if (isConfigValid) {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          setUser(user);
          setLoading(false);
        });
        return () => unsubscribe();
    } else {
        setLoading(false);
    }
  }, [isConfigValid]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isConfigValid) {
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
