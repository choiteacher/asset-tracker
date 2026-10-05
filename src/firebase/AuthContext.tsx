// Firebase 로그인 상태. 회원가입 기능은 두지 않는다(관리자 계정은 Firebase 콘솔에서만 만든다).

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getFirebase } from './client';

export type AuthStatus = 'config-missing' | 'loading' | 'signed-out' | 'signed-in';

interface AuthValue {
  status: AuthStatus;
  user: User | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const Context = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const firebase = getFirebase();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(firebase ? 'loading' : 'config-missing');

  useEffect(() => {
    if (!firebase) return;
    return onAuthStateChanged(firebase.auth, (u) => {
      setUser(u);
      setStatus(u ? 'signed-in' : 'signed-out');
    });
  }, [firebase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!firebase) throw new Error('Firebase 설정이 없습니다.');
      await signInWithEmailAndPassword(firebase.auth, email.trim(), password);
    },
    [firebase],
  );

  const doSignOut = useCallback(async () => {
    if (firebase) await signOut(firebase.auth);
  }, [firebase]);

  const value = useMemo(() => ({ status, user, signIn, signOut: doSignOut }), [status, user, signIn, doSignOut]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider 안에서만 사용할 수 있습니다.');
  return value;
}
