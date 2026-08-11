
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { deriveAuthEmail } from '@/lib/auth-email';
import { type UserData } from '@/lib/types';

// 시드 계정 목록. Firestore 문서 ID와 Firebase Auth UID를 동일하게 유지하므로
// 여기 적힌 uid 값은 seed-data.ts가 만드는 계정과 정확히 일치해야 합니다.
export const SEED_TEACHER_NAME = 'Great Teacher';

const mockTeacher: UserData = {
    uid: 'teacher-mock-uid',
    docId: 'teacher-mock-uid',
    displayName: SEED_TEACHER_NAME,
    email: 'teacher@speaksmart.edu',
    photoURL: `https://placehold.co/40x40.png?text=G`,
    role: 'teacher',
    createdAt: 0,
    isMock: true, // Flag to identify mock users
};

const mockStudent1: UserData = {
    uid: 'student1-mock-uid',
    docId: 'student1-mock-uid',
    displayName: '일학생',
    email: 'student1@example.com',
    photoURL: `https://placehold.co/40x40.png?text=일`,
    role: 'student',
    createdAt: 0,
    isMock: true,
};

const mockStudent2: UserData = {
    uid: 'student2-mock-uid',
    docId: 'student2-mock-uid',
    displayName: '이학생',
    email: 'student2@example.com',
    photoURL: `https://placehold.co/40x40.png?text=이`,
    role: 'student',
    createdAt: 0,
    isMock: true,
};

const mockStudent3: UserData = {
    uid: 'student3-mock-uid',
    docId: 'student3-mock-uid',
    displayName: '삼학생',
    email: 'student3@example.com',
    photoURL: `https://placehold.co/40x40.png?text=삼`,
    role: 'student',
    createdAt: 0,
    isMock: true,
};

export const mockStudents = [mockStudent1, mockStudent2, mockStudent3];

// 데모 학생 계정의 기본 비밀번호. scripts/seed.ts 의 값과 일치해야 동작합니다.
// 교사 계정은 여기 두지 않습니다. 클라이언트 번들에 들어가면 누구나 꺼내 볼 수 있어,
// 교사 로그인은 입력받은 비밀번호를 Firebase Auth 가 직접 검증하도록 했습니다.
const SEED_CREDENTIALS: Record<'student1' | 'student2' | 'student3', { name: string; password: string }> = {
  student1: { name: mockStudent1.displayName, password: '123456' },
  student2: { name: mockStudent2.displayName, password: '123456' },
  student3: { name: mockStudent3.displayName, password: '123456' },
};

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  /** 이름(아이디) + 비밀번호로 로그인. 성공 시 users 문서를 읽어 반환합니다. */
  login: (name: string, password: string) => Promise<UserData>;
  /** 데모용 학생 시드 계정 로그인. 실제 Firebase Auth 로그인을 수행합니다. */
  loginAs: (role: 'student1' | 'student2' | 'student3') => Promise<UserData>;
  /** 프로필 수정 후 users 문서를 다시 읽어 컨텍스트를 갱신합니다. */
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** users/{uid} 문서를 읽어 UserData로 변환. 문서가 없으면 null. */
async function loadUserDoc(firebaseUser: FirebaseUser): Promise<UserData | null> {
  const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
  if (!snap.exists()) return null;
  // uid/docId는 항상 Auth UID(= Firestore 문서 ID)로 통일합니다.
  return { ...snap.data(), uid: firebaseUser.uid, docId: firebaseUser.uid } as UserData;
}

/**
 * 서버 액션이 호출자를 확인할 수 있도록 httpOnly 세션 쿠키를 심습니다.
 * 서버 액션은 인증 없이도 POST 되는 엔드포인트라 이 쿠키가 유일한 신원 근거입니다.
 * (검증은 src/lib/auth-guard.ts)
 */
async function syncServerSession(firebaseUser: FirebaseUser | null): Promise<void> {
  try {
    if (!firebaseUser) {
      await fetch('/api/session', { method: 'DELETE' });
      return;
    }
    const idToken = await firebaseUser.getIdToken();
    await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch (error) {
    // 쿠키를 못 심어도 화면은 떠야 합니다. 다만 서버 액션은 거부됩니다.
    console.error('세션 쿠키 동기화 실패:', error);
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        await syncServerSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      // 새로고침·토큰 갱신 때도 쿠키를 다시 심어 만료된 채로 남지 않게 합니다.
      await syncServerSession(firebaseUser);

      try {
        const userData = await loadUserDoc(firebaseUser);
        if (!userData) {
          // Auth 계정은 있으나 프로필 문서가 없는 상태. 로그인 상태로 두면
          // 역할을 알 수 없어 화면이 깨지므로 로그아웃 처리합니다.
          console.error('Auth 계정에 대응하는 users 문서가 없습니다:', firebaseUser.uid);
          await signOut(auth);
          setUser(null);
        } else {
          setUser(userData);
        }
      } catch (error) {
        console.error('사용자 프로필을 불러오지 못했습니다.', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (name: string, password: string): Promise<UserData> => {
    const credential = await signInWithEmailAndPassword(auth, deriveAuthEmail(name), password);
    const userData = await loadUserDoc(credential.user);
    if (!userData) {
      await signOut(auth);
      throw new Error('사용자 프로필 문서를 찾을 수 없습니다.');
    }
    await syncServerSession(credential.user);
    setUser(userData);
    return userData;
  }, []);

  const loginAs = useCallback(
    (role: 'student1' | 'student2' | 'student3') => {
      const { name, password } = SEED_CREDENTIALS[role];
      return login(name, password);
    },
    [login]
  );

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    const userData = await loadUserDoc(auth.currentUser);
    if (userData) setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    await syncServerSession(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    loginAs,
    refreshUser,
    logout,
  }), [user, loading, login, loginAs, refreshUser, logout]);

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
