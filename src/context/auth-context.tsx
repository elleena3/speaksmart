
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { type UserData } from '@/lib/types';

// Mock data remains for quick testing via the main page
const mockTeacher: UserData = {
    uid: 'teacher-mock-uid',
    docId: 'teacher-mock-uid', // Add docId for consistency
    displayName: '김선생',
    email: 'teacher@example.com',
    photoURL: `https://placehold.co/40x40.png?text=김`,
    role: 'teacher',
    createdAt: Date.now(),
};

const mockStudent1: UserData = {
    uid: 'student1-mock-uid',
    docId: 'student1-mock-uid', // Add docId for consistency
    displayName: '일학생',
    email: 'student1@example.com',
    photoURL: `https://placehold.co/40x40.png?text=일`,
    role: 'student',
    createdAt: Date.now(),
};

const mockStudent2: UserData = {
    uid: 'student2-mock-uid',
    docId: 'student2-mock-uid', // Add docId for consistency
    displayName: '이학생',
    email: 'student2@example.com',
    photoURL: `https://placehold.co/40x40.png?text=이`,
    role: 'student',
    createdAt: Date.now(),
};

const mockStudent3: UserData = {
    uid: 'student3-mock-uid',
    docId: 'student3-mock-uid', // Add docId for consistency
    displayName: '삼학생',
    email: 'student3@example.com',
    photoURL: `https://placehold.co/40x40.png?text=삼`,
    role: 'student',
    createdAt: Date.now(),
};

export const mockStudents = [mockStudent1, mockStudent2, mockStudent3];

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  loginAs: (role: 'teacher' | 'student1' | 'student2' | 'student3') => void;
  manualLogin: (userData: UserData) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_SESSION_KEY = 'speaksmart_user_session';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for user session in sessionStorage on initial load
    try {
      const savedUser = sessionStorage.getItem(USER_SESSION_KEY);
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
        console.error("Failed to parse user session from storage", error);
        sessionStorage.removeItem(USER_SESSION_KEY);
    }
    setLoading(false);
  }, []);

  const manualLogin = (userData: UserData) => {
    // Ensure docId is present. If it's a real login, it will be.
    // If it's a mock login without one, we can default it for settings page to work.
    const userToSave = { ...userData, docId: userData.docId || userData.uid };
    setUser(userToSave);
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(userToSave));
  };
  
  const loginAs = (role: 'teacher' | 'student1' | 'student2' | 'student3') => {
      let mockUserToLogin: UserData;
      if (role === 'teacher') {
          mockUserToLogin = mockTeacher;
      } else if (role === 'student1') {
          mockUserToLogin = mockStudent1;
      } else if (role === 'student2') {
          mockUserToLogin = mockStudent2;
      } else {
          mockUserToLogin = mockStudent3;
      }
      manualLogin(mockUserToLogin);
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(USER_SESSION_KEY);
  };

  const value = useMemo(() => ({
    user,
    loading,
    loginAs,
    manualLogin,
    logout,
  }), [user, loading]);

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
