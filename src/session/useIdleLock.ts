import { useEffect, useRef } from 'react';
import { isIdleExpired } from '../auth/idle';

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
const CHECK_INTERVAL_MS = 5_000;

/** 무조작 상태가 autoLockMinutes 이상 이어지면 onLock을 호출한다. */
export function useIdleLock(autoLockMinutes: number, onLock: () => void): void {
  const lastActivity = useRef(Date.now());
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  useEffect(() => {
    lastActivity.current = Date.now();
    const markActive = () => {
      lastActivity.current = Date.now();
    };
    const check = () => {
      if (isIdleExpired(lastActivity.current, Date.now(), autoLockMinutes)) onLockRef.current();
    };
    // 탭이 백그라운드에 있으면 타이머가 늦게 돌 수 있어, 돌아올 때 먼저 확인한다(확인 전 조작은 활동으로 치지 않는다).
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };

    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, markActive, { passive: true, capture: true });
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActive, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [autoLockMinutes]);
}
