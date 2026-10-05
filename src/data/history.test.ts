import { describe, expect, it } from 'vitest';
import { addDailySnapshot, aggregateSnapshots, appendChange, MAX_CHANGE_LOG, type Snapshot } from './history';

const snap = (date: string, net: number): Snapshot => ({ date, net, liquid: net, frozen: 0, debt: 0 });

describe('스냅샷', () => {
  it('같은 날짜는 한 번만 기록한다', () => {
    const list = [snap('2026-10-01', 1)];
    expect(addDailySnapshot(list, snap('2026-10-01', 2))).toBeNull();
    expect(addDailySnapshot(list, snap('2026-10-02', 2))?.map((s) => s.date)).toEqual(['2026-10-01', '2026-10-02']);
  });

  it('주별(월요일 기준)·월별로 묶어 구간의 마지막 값을 쓴다', () => {
    const list = [snap('2026-09-28', 1), snap('2026-10-02', 2), snap('2026-10-05', 3), snap('2026-11-01', 4)];
    expect(aggregateSnapshots(list, 'week').map((s) => [s.key, s.net])).toEqual([
      ['2026-09-28', 2],
      ['2026-10-05', 3],
      ['2026-10-26', 4],
    ]);
    expect(aggregateSnapshots(list, 'month').map((s) => [s.key, s.net])).toEqual([
      ['2026-09', 1],
      ['2026-10', 3],
      ['2026-11', 4],
    ]);
  });
});

describe('변경 내역', () => {
  it('최대 개수를 넘으면 오래된 것부터 버린다', () => {
    let log = appendChange([], { at: '0', kind: 'asset', action: 'create', label: 'a' });
    for (let i = 1; i <= MAX_CHANGE_LOG; i++) log = appendChange(log, { at: String(i), kind: 'asset', action: 'update', label: 'a' });
    expect(log).toHaveLength(MAX_CHANGE_LOG);
    expect(log[0]!.at).toBe('1');
  });
});
