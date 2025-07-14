
// src/context/auth-context.tsx
"use client";

import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import type { User } from 'firebase/auth';

// This is a mock user object for testing purposes when login is disabled.
const mockUser: User = {
    uid: 'test-user-id',
    displayName: '테스트 사용자',
    email: 'test@example.com',
    photoURL: `https://placehold.co/40x40.png?text=T`,
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Since login is disabled for testing, we provide a mock user.
  // The loading state is set to false immediately.
  const value = useMemo(() => ({
    user: mockUser,
    loading: false,
  }), []);

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
