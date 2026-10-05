import { describe, expect, it } from 'vitest';
import { isIdleExpired } from './idle';
import { assessPassword, MIN_PASSWORD_LENGTH } from './passwordStrength';
import { delayForFailures, EMPTY_THROTTLE, MAX_DELAY_MS, recordFailure, remainingWaitMs } from './unlockThrottle';

describe('점진적 지연', () => {
  it('2회 실패까지는 지연이 없고, 3회부터 2초·4초·8초로 늘어난다', () => {
    expect([0, 1, 2, 3, 4, 5].map(delayForFailures)).toEqual([0, 0, 0, 2000, 4000, 8000]);
  });

  it('지연은 최대 5분을 넘지 않는다', () => {
    expect(delayForFailures(50)).toBe(MAX_DELAY_MS);
  });

  it('남은 대기 시간은 마지막 실패 시각 기준으로 줄어든다', () => {
    const t0 = 1_000_000;
    let state = EMPTY_THROTTLE;
    for (let i = 0; i < 3; i++) state = recordFailure(state, t0);
    expect(remainingWaitMs(state, t0)).toBe(2000);
    expect(remainingWaitMs(state, t0 + 1500)).toBe(500);
    expect(remainingWaitMs(state, t0 + 5000)).toBe(0);
    expect(remainingWaitMs(EMPTY_THROTTLE, t0)).toBe(0);
  });
});

describe('자동 잠금 판정', () => {
  const t0 = 1_000_000;
  it('설정 시간 직전에는 잠그지 않고, 도달하면 잠근다', () => {
    expect(isIdleExpired(t0, t0 + 10 * 60_000 - 1, 10)).toBe(false);
    expect(isIdleExpired(t0, t0 + 10 * 60_000, 10)).toBe(true);
  });
});

describe('비밀번호 강도', () => {
  it(`최소 ${MIN_PASSWORD_LENGTH}자 미만이면 기준 미달`, () => {
    expect(assessPassword('Ab1!xyz').meetsMinimum).toBe(false);
    expect(assessPassword('Ab1!xyzabc').meetsMinimum).toBe(true);
  });

  it('길고 다양한 문자를 쓸수록 등급이 오른다', () => {
    expect(assessPassword('abcdefghij').level).toBeLessThan(assessPassword('Abcdefgh12!?xyzQ').level);
    expect(assessPassword('Abcdefgh12!?xyzQ').level).toBe(4);
  });

  it('반복·연속 문자만으로 된 비밀번호는 매우 약함', () => {
    expect(assessPassword('aaaaaaaaaaaa').level).toBe(0);
    expect(assessPassword('1234567890').level).toBe(0);
  });
});
