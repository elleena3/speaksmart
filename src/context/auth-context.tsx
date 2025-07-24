

// src/context/auth-context.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { getAuth, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { type UserData } from '@/lib/types';

const auth = getAuth(app);

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

export const mockStudents = [mockStudent1, mockStudent2, mockStudent3];


interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  loginAs: (role: 'teacher' | 'student1' | 'student2' | 'student3') => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Fetch user data from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserData(userDoc.data() as UserData);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    setLoading(true);
    await signOut(auth);
    setUser(null);
    setUserData(null);
    setLoading(false);
  };


  const value = useMemo(() => ({
    user,
    userData,
    loading,
    logout,
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
        setUserData(null); // Mock users don't have firestore data
        setLoading(false);
    }
  }), [user, userData, loading]);

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex h-screen w-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : children}
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
