
// src/context/auth-context.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { app } from '@/lib/firebase'; // Ensure app is initialized
import { Loader2 } from 'lucide-react';

// Get the Auth instance
const auth = getAuth(app);

// 로컬 테스트용 목업(가짜) 사용자 객체입니다.
const mockTeacher: User = {
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

const mockStudent1: User = {
    uid: 'student1-mock-uid',
    displayName: '일학생',
    email: 'student1@example.com',
    photoURL: `https://placehold.co/40x40.png?text=일`,
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


const mockStudent2: User = {
    uid: 'student2-mock-uid',
    displayName: '이학생',
    email: 'student2@example.com',
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


const mockStudent3: User = {
    uid: 'student3-mock-uid',
    displayName: '삼학생',
    email: 'student3@example.com',
    photoURL: `https://placehold.co/40x40.png?text=삼`,
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
  loginAs: (role: 'teacher' | 'student1' | 'student2' | 'student3') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This listener will be used if real Firebase Auth is implemented
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // For now, we ignore the real auth state and rely on mock login
      // setUser(user); 
      setLoading(false);
    });

    // Clean up subscription on unmount
    return () => unsubscribe();
  }, []);


  const value = useMemo(() => ({
    user,
    loading,
    loginAs: (role: 'teacher' | 'student1' | 'student2' | 'student3') => {
        setLoading(true);
        if (role === 'teacher') {
            setUser(mockTeacher);
        } else if (role === 'student1') {
            setUser(mockStudent1);
        } else if (role === 'student2') {
            setUser(mockStudent2);
        } else if (role === 'student3') {
            setUser(mockStudent3);
        }
        setLoading(false);
    }
  }), [user, loading]);

  if (loading) {
     return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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
