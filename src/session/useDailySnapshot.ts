import { useEffect, useRef } from 'react';
import { toIsoDate } from '../data/assets';
import { addDailySnapshot, type Snapshot } from '../data/history';
import type { AppData } from '../data/schema';
import { computeNetWorth } from '../engine/networth';
import { useSession, useUnlockedData } from './SessionContext';

export function snapshotOf(data: AppData, nowMs: number): Snapshot {
  const nw = computeNetWorth({ assets: data.assets, loans: data.loans, taxRates: data.settings.taxRates }, nowMs);
  return {
    date: toIsoDate(new Date(nowMs)),
    net: Math.round(nw.net.net),
    liquid: Math.round(nw.portfolio.liquid.net),
    frozen: Math.round(nw.portfolio.frozen.net),
    debt: Math.round(nw.debt.total),
  };
}

/** 잠금 해제 후 오늘 스냅샷이 없으면 하루 1회 기록한다(변경 내역·백업 권장에는 영향 없음). */
export function useDailySnapshot(): void {
  const data = useUnlockedData();
  const { updateData } = useSession();
  const done = useRef<string | null>(null);
  const today = toIsoDate(new Date());

  useEffect(() => {
    if (done.current === today) return;
    if (data.snapshots.some((s) => s.date === today)) {
      done.current = today;
      return;
    }
    done.current = today;
    updateData((d) => {
      const next = addDailySnapshot(d.snapshots, snapshotOf(d, Date.now()));
      return next ? { ...d, snapshots: next } : d;
    }).catch(() => {
      done.current = null; // 다음 기회에 다시 시도
    });
  }, [data.snapshots, today, updateData]);
}
