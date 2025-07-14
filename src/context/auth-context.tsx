
// src/context/auth-context.tsx
"use client";

import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import type { User } from 'firebase/auth';

// 로컬 테스트용 목업(가짜) 사용자 객체입니다.
const mockUser: User = {
    uid: 'teacher-mock-uid',
    displayName: '김선생',
    email: 'teacher@example.com',
    photoURL: `https://placehold.co/40x40.png?text=김`,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    providerId: 'password',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'mock-token',
    getIdTokenResult: async () => ({
        token: 'mock-token',
        expirationTime: '',
        authTime: '',
        issuedAtTime: '',
        signInProvider: null,
        signInSecondFactor: null,
        claims: {},
    }),
    reload: async () => {},
    toJSON: () => ({}),
};

const mockStudent: User = {
    uid: 'student-mock-uid',
    displayName: '이학생',
    email: 'student@example.com',
    photoURL: `https://placehold.co/40x40.png?text=이`,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    providerId: 'password',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'mock-token',
    getIdTokenResult: async () => ({
        token: 'mock-token',
        expirationTime: '',
        authTime: '',
        issuedAtTime: '',
        signInProvider: null,
        signInSecondFactor: null,
        claims: {},
    }),
    reload: async () => {},
    toJSON: () => ({}),
};


interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginAs: (role: 'teacher' | 'student') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const value = useMemo(() => ({
    user,
    loading: false, // 로딩 상태를 항상 false로 설정
    loginAs: (role: 'teacher' | 'student') => {
        if (role === 'teacher') {
            setUser(mockUser);
        } else {
            setUser(mockStudent);
        }
    }
  }), [user]);

  return (
    <AuthContext.Provider value={value}>
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
