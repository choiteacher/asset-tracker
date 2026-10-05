// 보는 사람별 화면 설정(자산 데이터 아님). localStorage에 저장하되 실패해도 기본값으로 동작한다.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type TaxView = 'net' | 'gross';
export type ThemePref = 'system' | 'light' | 'dark';

interface PrefsState {
  taxView: TaxView;
  /** 금액 가리기(옆 사람 시선 대비). */
  masked: boolean;
  theme: ThemePref;
  largeText: boolean;
}

interface DisplayPrefs extends PrefsState {
  setTaxView(view: TaxView): void;
  setMasked(masked: boolean): void;
  setTheme(theme: ThemePref): void;
  setLargeText(large: boolean): void;
  /** 실제 적용 중인 테마. */
  resolvedTheme: 'light' | 'dark';
}

const KEY = 'asset-tracker.display';
const DEFAULTS: PrefsState = { taxView: 'net', masked: false, theme: 'system', largeText: false };

function load(): PrefsState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    return {
      taxView: raw.taxView === 'gross' ? 'gross' : 'net',
      masked: raw.masked === true,
      theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system',
      largeText: raw.largeText === true,
    };
  } catch {
    return DEFAULTS;
  }
}

function store(value: PrefsState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // 저장할 수 없어도 화면 동작에는 문제없다.
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
}

const Context = createContext<DisplayPrefs | null>(null);

export function DisplayPrefsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = state.theme === 'system' ? (systemDark ? 'dark' : 'light') : state.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-bs-theme', resolvedTheme);
    root.classList.toggle('app-large', state.largeText);
  }, [resolvedTheme, state.largeText]);

  const update = useCallback((patch: Partial<PrefsState>) => {
    setState((s) => {
      const next = { ...s, ...patch };
      store(next);
      return next;
    });
  }, []);

  const value = useMemo<DisplayPrefs>(
    () => ({
      ...state,
      resolvedTheme,
      setTaxView: (taxView) => update({ taxView }),
      setMasked: (masked) => update({ masked }),
      setTheme: (theme) => update({ theme }),
      setLargeText: (largeText) => update({ largeText }),
    }),
    [state, resolvedTheme, update],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDisplayPrefs(): DisplayPrefs {
  const value = useContext(Context);
  if (!value) throw new Error('DisplayPrefsProvider 안에서만 사용할 수 있습니다.');
  return value;
}
