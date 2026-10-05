/** 마지막 조작 이후 설정 시간이 지났으면 true. */
export function isIdleExpired(lastActivityAt: number, now: number, autoLockMinutes: number): boolean {
  return now - lastActivityAt >= autoLockMinutes * 60_000;
}
