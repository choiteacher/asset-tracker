// 자산 기록(하루 1회 스냅샷)과 변경 내역. 모두 암호화 데이터 안에 저장된다.

import type { IsoDate } from './assets';

export interface Snapshot {
  date: IsoDate;
  net: number;
  liquid: number;
  frozen: number;
  debt: number;
}

export type ChangeKind = 'asset' | 'loan' | 'housing' | 'settings';
export type ChangeAction = 'create' | 'update' | 'delete';

export interface ChangeEntry {
  at: string;
  kind: ChangeKind;
  action: ChangeAction;
  /** 항목 이름(예: 상품명). */
  label: string;
}

export const CHANGE_KIND_LABELS: Record<ChangeKind, string> = {
  asset: '자산',
  loan: '대출',
  housing: '분양 일정',
  settings: '설정',
};

export const CHANGE_ACTION_LABELS: Record<ChangeAction, string> = {
  create: '등록',
  update: '수정',
  delete: '삭제',
};

/** 변경 내역은 최근 2,000건까지만 보관한다. */
export const MAX_CHANGE_LOG = 2000;

export function appendChange(log: readonly ChangeEntry[], entry: ChangeEntry): ChangeEntry[] {
  const next = [...log, entry];
  return next.length > MAX_CHANGE_LOG ? next.slice(next.length - MAX_CHANGE_LOG) : next;
}

/** 오늘 스냅샷이 없을 때만 추가한다(같은 날짜면 그대로). */
export function addDailySnapshot(snapshots: readonly Snapshot[], snapshot: Snapshot): Snapshot[] | null {
  if (snapshots.some((s) => s.date === snapshot.date)) return null;
  return [...snapshots, snapshot].sort((a, b) => a.date.localeCompare(b.date));
}

export type Period = 'week' | 'month';

function weekKey(iso: IsoDate): string {
  // 그 주의 월요일 날짜를 키로 쓴다.
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  const diff = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - diff);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 주별/월별로 묶어 각 구간의 마지막 스냅샷을 대표값으로 쓴다. */
export function aggregateSnapshots(snapshots: readonly Snapshot[], period: Period): (Snapshot & { key: string })[] {
  const map = new Map<string, Snapshot>();
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sorted) map.set(period === 'month' ? s.date.slice(0, 7) : weekKey(s.date), s);
  return [...map.entries()].map(([key, s]) => ({ ...s, key }));
}
