// 날짜 도우미. 날짜 문자열 'YYYY-MM-DD'는 모두 "현지 시각 자정"으로 해석한다.

import type { IsoDate } from '../data/assets';

export const DAY_MS = 86_400_000;
/** 이자 계산 기준: 1년 = 365일(단리 일할 계산). */
export const YEAR_MS = 365 * DAY_MS;

function parse(iso: IsoDate): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return [y, m, d];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatIso(y: number, m: number, d: number): IsoDate {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 'YYYY-MM-DD' → 그날 현지 자정의 밀리초. */
export function dateMs(iso: IsoDate): number {
  const [y, m, d] = parse(iso);
  return new Date(y, m - 1, d).getTime();
}

export function isoFromMs(ms: number): IsoDate {
  const date = new Date(ms);
  return formatIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function startOfDay(ms: number): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

/** iso가 속한 달에서 k개월 뒤 달의 day일(그 달에 없는 날이면 말일). */
export function monthDate(iso: IsoDate, k: number, day: number): IsoDate {
  const [y, m] = parse(iso);
  const total = m - 1 + k;
  const yy = y + Math.floor(total / 12);
  const mm = (((total % 12) + 12) % 12) + 1;
  return formatIso(yy, mm, Math.min(day, daysInMonth(yy, mm)));
}

export function dayOfMonth(iso: IsoDate): number {
  return parse(iso)[2];
}

/** after 다음 날부터 until(포함)까지, 매월 day일(말일 보정)인 날짜 목록. */
export function monthlyDatesBetween(after: IsoDate, day: number, until: IsoDate): IsoDate[] {
  const result: IsoDate[] = [];
  for (let k = 0; k < 1200; k++) {
    const d = monthDate(after, k, day);
    if (d > until) break;
    if (d > after) result.push(d);
  }
  return result;
}

/** 오늘 기준 D-day(오늘=0, 내일=1, 어제=-1). */
export function daysUntil(iso: IsoDate, nowMs: number): number {
  return Math.round((dateMs(iso) - startOfDay(nowMs)) / DAY_MS);
}

/** a~b 사이의 달 차이(일 무시). */
export function monthIndexDiff(a: IsoDate, b: IsoDate): number {
  const [ay, am] = parse(a);
  const [by, bm] = parse(b);
  return (by - ay) * 12 + (bm - am);
}
