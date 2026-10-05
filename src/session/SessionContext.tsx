import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { VaultKey } from '../crypto/vault';
import { appendChange, type ChangeEntry } from '../data/history';
import { clampAutoLockMinutes, type AppData } from '../data/schema';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { downloadTextFile } from '../utils/download';
import {
  changeVaultPassword,
  createVault,
  exportVaultBackup,
  openVault,
  persistVault,
  restoreVaultBackup,
  type OpenVault,
} from './vaultService';

/** forbidden: 로그인은 됐지만 보안 규칙상 이 계정은 데이터에 접근할 수 없음(관리자 아님). */
export type SessionStatus = 'loading' | 'setup' | 'locked' | 'unlocked' | 'unavailable' | 'forbidden';

interface SessionValue {
  status: SessionStatus;
  /** 잠금 해제 상태에서만 존재. 잠그면 null로 지운다. */
  data: AppData | null;
  setup(password: string): Promise<void>;
  unlock(password: string): Promise<void>;
  lock(): void;
  /**
   * 데이터를 바꾸고 암호화해 저장한다. change를 넘기면 변경 내역에 기록하고 "마지막 데이터 변경 시각"을 갱신한다
   * (스냅샷 자동 기록처럼 사용자가 바꾼 것이 아니면 생략).
   */
  updateData(mutate: (current: AppData) => AppData, change?: Omit<ChangeEntry, 'at'>): Promise<void>;
  setAutoLockMinutes(minutes: number): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  exportBackup(): Promise<void>;
  restoreBackup(fileText: string, password: string): Promise<void>;
  resetAll(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function isPermissionDenied(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'permission-denied';
}

/**
 * adapter: 암호문을 보관할 저장소(Firestore 문서).
 * onLock: 잠글 때(수동·자동) 호출. 앱은 여기서 Firebase 로그아웃까지 한다.
 */
export function SessionProvider({
  children,
  adapter,
  onLock,
}: {
  children: ReactNode;
  adapter: StorageAdapter;
  onLock?: () => void;
}) {
  const storage = adapter;
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [data, setData] = useState<AppData | null>(null);
  // 키와 최신 데이터는 메모리(ref)에만 둔다.
  const keyRef = useRef<VaultKey | null>(null);
  const dataRef = useRef<AppData | null>(null);
  // 저장이 겹치지 않도록 순서대로 실행한다.
  const saveChain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    storage
      .load()
      .then((envelope) => !cancelled && setStatus(envelope ? 'locked' : 'setup'))
      .catch((e) => !cancelled && setStatus(isPermissionDenied(e) ? 'forbidden' : 'unavailable'));
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const enter = useCallback((opened: OpenVault) => {
    keyRef.current = opened.vaultKey;
    dataRef.current = opened.data;
    setData(opened.data);
    setStatus('unlocked');
  }, []);

  const lock = useCallback(() => {
    keyRef.current = null;
    dataRef.current = null;
    setData(null);
    setStatus('locked');
    onLockRef.current?.();
  }, []);

  const requireOpen = useCallback((): { vaultKey: VaultKey; data: AppData } => {
    if (!keyRef.current || !dataRef.current) throw new Error('잠금 상태입니다. 다시 잠금 해제해 주세요.');
    return { vaultKey: keyRef.current, data: dataRef.current };
  }, []);

  const enqueue = useCallback((task: () => Promise<void>): Promise<void> => {
    const run = saveChain.current.then(task, task);
    saveChain.current = run.catch(() => undefined);
    return run;
  }, []);

  const setup = useCallback(
    async (password: string) => {
      enter(await createVault(storage, password, new Date()));
    },
    [storage, enter],
  );

  const unlock = useCallback(
    async (password: string) => {
      enter(await openVault(storage, password));
    },
    [storage, enter],
  );

  const updateData = useCallback(
    (mutate: (current: AppData) => AppData, change?: Omit<ChangeEntry, 'at'>) =>
      enqueue(async () => {
        const { vaultKey, data: current } = requireOpen();
        const nowIso = new Date().toISOString();
        let next = mutate(current);
        if (change) {
          next = {
            ...next,
            changeLog: appendChange(next.changeLog, { ...change, at: nowIso }),
            meta: { ...next.meta, lastDataChangeAt: nowIso },
          };
        }
        const stamped: AppData = { ...next, meta: { ...next.meta, lastModifiedAt: nowIso } };
        await persistVault(storage, vaultKey, stamped);
        if (keyRef.current !== vaultKey) return; // 저장 중 잠겼으면 화면에 되살리지 않는다.
        dataRef.current = stamped;
        setData(stamped);
      }),
    [storage, enqueue, requireOpen],
  );

  const setAutoLockMinutes = useCallback(
    (minutes: number) =>
      updateData((d) => ({ ...d, settings: { ...d.settings, autoLockMinutes: clampAutoLockMinutes(minutes) } }), {
        kind: 'settings',
        action: 'update',
        label: '자동 잠금 시간',
      }),
    [updateData],
  );

  const changePassword = useCallback(
    (currentPassword: string, newPassword: string) =>
      enqueue(async () => {
        const { data: current } = requireOpen();
        enter(await changeVaultPassword(storage, currentPassword, newPassword, current, new Date()));
      }),
    [storage, enqueue, requireOpen, enter],
  );

  const exportBackup = useCallback(
    () =>
      enqueue(async () => {
        const { vaultKey, data: current } = requireOpen();
        const result = await exportVaultBackup(storage, vaultKey, current, new Date());
        downloadTextFile(result.fileName, result.fileText);
        dataRef.current = result.data;
        setData(result.data);
      }),
    [storage, enqueue, requireOpen],
  );

  const restoreBackup = useCallback(
    (fileText: string, password: string) =>
      enqueue(async () => {
        enter(await restoreVaultBackup(storage, fileText, password));
        }),
    [storage, enqueue, enter],
  );

  const resetAll = useCallback(
    () =>
      enqueue(async () => {
        await storage.clear();
        keyRef.current = null;
        dataRef.current = null;
        setData(null);
        setStatus('setup');
      }),
    [storage, enqueue],
  );

  const value = useMemo<SessionValue>(
    () => ({
      status,
      data,
      setup,
      unlock,
      lock,
      updateData,
      setAutoLockMinutes,
      changePassword,
      exportBackup,
      restoreBackup,
      resetAll,
    }),
    [status, data, setup, unlock, lock, updateData, setAutoLockMinutes, changePassword, exportBackup, restoreBackup, resetAll],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider 안에서만 사용할 수 있습니다.');
  return value;
}

/** 잠금 해제된 화면에서만 쓰는 편의 훅. */
export function useUnlockedData(): AppData {
  const { data } = useSession();
  if (!data) throw new Error('잠금 상태입니다.');
  return data;
}
