// 앱 안 알림: 예적금 만기, 대출 상환일, 분양 지급일 D-day 목록(순수 함수).

import { hasMaturity, type Asset } from '../data/assets';
import type { HousingPlan } from '../data/housing';
import type { Loan } from '../data/loans';
import { buildSchedule } from './loan';
import { daysUntil } from './time';

export type AlertKind = 'maturity' | 'loan' | 'housing';

export interface DdayAlert {
  id: string;
  kind: AlertKind;
  title: string;
  date: string;
  days: number;
  link: string;
}

/** 이 기간(일) 안에 다가오는 일정만 보여준다. */
export const ALERT_WINDOW_DAYS: Record<AlertKind, number> = { maturity: 60, loan: 14, housing: 90 };

export function buildAlerts(
  input: { assets: readonly Asset[]; loans: readonly Loan[]; housing: HousingPlan | null },
  nowMs: number,
): DdayAlert[] {
  const alerts: DdayAlert[] = [];
  const within = (kind: AlertKind, days: number) => days >= 0 && days <= ALERT_WINDOW_DAYS[kind];

  for (const a of input.assets) {
    if (!hasMaturity(a)) continue;
    const days = daysUntil(a.maturityDate, nowMs);
    if (within('maturity', days)) alerts.push({ id: `m-${a.id}`, kind: 'maturity', title: `${a.name} 만기`, date: a.maturityDate, days, link: '/' });
  }
  for (const loan of input.loans) {
    const next = buildSchedule(loan).find((r) => daysUntil(r.date, nowMs) >= 0);
    if (!next) continue;
    const days = daysUntil(next.date, nowMs);
    if (within('loan', days)) alerts.push({ id: `l-${loan.id}`, kind: 'loan', title: `${loan.name} 상환일`, date: next.date, days, link: `/loans/${loan.id}` });
  }
  for (const p of input.housing?.payments ?? []) {
    const days = daysUntil(p.date, nowMs);
    if (within('housing', days)) alerts.push({ id: `h-${p.id}`, kind: 'housing', title: `분양 ${p.label}`, date: p.date, days, link: '/housing' });
  }
  return alerts.sort((a, b) => a.days - b.days || a.title.localeCompare(b.title));
}
