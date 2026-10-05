// 잠금 해제 실패 시 점진적 지연.
// 실패 횟수는 자산 데이터가 아니므로 localStorage에 평문으로 둔다(횟수와 마지막 실패 시각만).
// 저장소를 지우면 초기화되므로 보조 수단이며, 근본 방어는 PBKDF2의 높은 반복 횟수다.

export const FREE_ATTEMPTS = 2;
export const MAX_DELAY_MS = 5 * 60 * 1000;

export interface ThrottleState {
  failures: number;
  lastFailureAt: number | null;
}

export const EMPTY_THROTTLE: ThrottleState = { failures: 0, lastFailureAt: null };

/** 실패 횟수에 따른 다음 시도까지의 대기 시간. 2회까지 0, 3회 2초, 4회 4초 … 최대 5분. */
export function delayForFailures(failures: number): number {
  if (failures <= FREE_ATTEMPTS) return 0;
  const exponent = failures - FREE_ATTEMPTS; // 1, 2, 3 …
  return Math.min(MAX_DELAY_MS, 1000 * 2 ** exponent);
}

export function remainingWaitMs(state: ThrottleState, now: number): number {
  if (state.lastFailureAt === null) return 0;
  const until = state.lastFailureAt + delayForFailures(state.failures);
  return Math.max(0, until - now);
}

export function recordFailure(state: ThrottleState, now: number): ThrottleState {
  return { failures: state.failures + 1, lastFailureAt: now };
}

const STORAGE_KEY = 'asset-tracker.unlock-throttle';

export function loadThrottle(): ThrottleState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_THROTTLE;
    const parsed = JSON.parse(raw) as Partial<ThrottleState>;
    const failures = Number.isInteger(parsed.failures) ? Math.max(0, parsed.failures as number) : 0;
    const lastFailureAt = typeof parsed.lastFailureAt === 'number' ? parsed.lastFailureAt : null;
    return { failures, lastFailureAt };
  } catch {
    return EMPTY_THROTTLE;
  }
}

export function storeThrottle(state: ThrottleState): void {
  try {
    if (state.failures === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 불가(사생활 보호 모드 등)면 메모리 상태만으로 동작한다.
  }
}
