import { useEffect, useState } from 'react';

/**
 * intervalMs마다 현재 시각을 돌려준다. 화면은 이 값으로 "지금 시각의 값"을 처음부터 다시 계산한다.
 * 탭이 숨겨지면 멈추고, 다시 보이면 즉시 갱신한다.
 */
export function useNow(intervalMs = 100): number {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    let timer: number | undefined;
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      setNow(Date.now());
      timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);

  return now;
}
