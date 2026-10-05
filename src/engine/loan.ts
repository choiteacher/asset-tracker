// 대출 상환 계산 엔진(순수 함수, 기준 시각 인자).
//  - 스케줄은 "잔액 기준일"의 잔액에서 시작해 매월 상환일마다 계산한다(월 이율 = 연이율/12).
//  - 원리금균등: 매월 같은 금액(자동 계산 또는 직접 입력). 마지막 회차에 남은 원금을 모두 갚는다.
//  - 원금균등: 원금을 남은 회차로 나눠 매월 같은 원금 + 그 달 이자.
//  - 만기일시: 매월 이자만, 만기에 원금 전액.
//  - 실시간: 마지막 상환일 이후 쌓인 이자를 일할(초 단위)로 "미납 누적 이자"로 계산한다.

import type { Loan } from '../data/loans';
import { dateMs, monthlyDatesBetween, YEAR_MS } from './time';

export interface ScheduleRow {
  index: number;
  date: string;
  dateMs: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface ScheduleOptions {
  /** 매월 추가로 갚는 원금. */
  extraMonthly?: number;
  /** 기준일에 즉시 갚는 원금(중도상환). */
  prepayNow?: number;
}

/** 잔액 기준일 다음부터 만기까지의 상환 예정일. 만기일이 상환일이 아니면 만기일을 마지막에 붙인다. */
export function paymentDates(loan: Loan): string[] {
  const from = loan.balanceAsOf > loan.startDate ? loan.balanceAsOf : loan.startDate;
  const dates = monthlyDatesBetween(from, loan.paymentDay, loan.maturityDate);
  if (dates.length === 0 || dates[dates.length - 1] !== loan.maturityDate) {
    if (loan.maturityDate > from) dates.push(loan.maturityDate);
  }
  return dates;
}

/** 원리금균등 월 상환액 자동 계산값. */
export function annuityPayment(balance: number, annualRatePct: number, months: number): number {
  if (months <= 0) return balance;
  const i = annualRatePct / 100 / 12;
  if (i === 0) return balance / months;
  return (balance * i) / (1 - (1 + i) ** -months);
}

export function autoMonthlyPayment(loan: Loan): number {
  return annuityPayment(loan.balance, loan.annualRatePct, paymentDates(loan).length);
}

export function buildSchedule(loan: Loan, options: ScheduleOptions = {}): ScheduleRow[] {
  const dates = paymentDates(loan);
  const n = dates.length;
  const i = loan.annualRatePct / 100 / 12;
  const extra = Math.max(0, options.extraMonthly ?? 0);
  let balance = Math.max(0, loan.balance - Math.max(0, options.prepayNow ?? 0));
  if (n === 0 || balance <= 0) return [];

  // 원래 조건 기준의 정액(중도상환해도 월 상환액/월 원금은 유지 → 기간 단축)
  const fixedPayment = loan.method === 'annuity' ? (loan.monthlyPayment ?? annuityPayment(loan.balance, loan.annualRatePct, n)) : 0;
  const fixedPrincipal = loan.method === 'equalPrincipal' ? loan.balance / n : 0;

  const rows: ScheduleRow[] = [];
  for (let k = 0; k < n && balance > 0.005; k++) {
    const interest = balance * i;
    let principal: number;
    if (loan.method === 'annuity') principal = Math.max(0, fixedPayment - interest) + extra;
    else if (loan.method === 'equalPrincipal') principal = fixedPrincipal + extra;
    else principal = extra;
    if (k === n - 1 || principal >= balance) principal = balance; // 마지막 회차 또는 조기 완납
    balance -= principal;
    const date = dates[k]!;
    rows.push({ index: k + 1, date, dateMs: dateMs(date), payment: principal + interest, principal, interest, balance: Math.max(0, balance) });
  }
  return rows;
}

export interface LoanState {
  /** 기준 시각의 원금 잔액. */
  balance: number;
  /** 마지막 상환 이후 쌓인 미납 이자. */
  accruedInterest: number;
  /** 잔액 기준일 이후 기준 시각까지 낸 이자·상환액 합계. */
  paidInterest: number;
  paidTotal: number;
  remainingInterest: number;
  /** 다음 상환 예정 회차(없으면 null). */
  next: ScheduleRow | null;
  /** 완전 상환 예정 회차(없으면 null). */
  payoff: ScheduleRow | null;
  remainingMonths: number;
  /** 지금 1ms당 늘어나는 이자. */
  perMs: number;
  active: boolean;
}

export function loanStateAt(loan: Loan, atMs: number, schedule: ScheduleRow[] = buildSchedule(loan)): LoanState {
  const startMs = dateMs(loan.startDate);
  const asOfMs = dateMs(loan.balanceAsOf);
  const rate = loan.annualRatePct / 100;
  const payoff = schedule.length ? schedule[schedule.length - 1]! : null;
  if (atMs < startMs) {
    return {
      balance: 0,
      accruedInterest: 0,
      paidInterest: 0,
      paidTotal: 0,
      remainingInterest: schedule.reduce((s, r) => s + r.interest, 0),
      next: schedule[0] ?? null,
      payoff,
      remainingMonths: schedule.length,
      perMs: 0,
      active: false,
    };
  }
  let balance = loan.balance;
  let lastMs = Math.max(asOfMs, startMs);
  let paidInterest = 0;
  let paidTotal = 0;
  let remainingInterest = 0;
  let next: ScheduleRow | null = null;
  let remainingMonths = 0;
  for (const row of schedule) {
    if (row.dateMs <= atMs) {
      balance = row.balance;
      lastMs = row.dateMs;
      paidInterest += row.interest;
      paidTotal += row.payment;
    } else {
      next ??= row;
      remainingInterest += row.interest;
      remainingMonths++;
    }
  }
  const accrued = atMs > lastMs ? (balance * rate * (atMs - lastMs)) / YEAR_MS : 0;
  return {
    balance,
    accruedInterest: accrued,
    paidInterest,
    paidTotal,
    remainingInterest,
    next,
    payoff,
    remainingMonths,
    perMs: (balance * rate) / YEAR_MS,
    active: balance > 0,
  };
}

/** 연결 현금 항목별로, 현금 기준일 이후 기준 시각까지 빠져나간 대출 상환액 합계. */
export function cashDeductionsAt(
  loans: readonly Loan[],
  cashAsOf: Readonly<Record<string, string>>,
  atMs: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const loan of loans) {
    if (!loan.linkedCashId || !(loan.linkedCashId in cashAsOf)) continue;
    const fromMs = dateMs(cashAsOf[loan.linkedCashId]!);
    let sum = 0;
    for (const row of buildSchedule(loan)) if (row.dateMs > fromMs && row.dateMs <= atMs) sum += row.payment;
    result[loan.linkedCashId] = (result[loan.linkedCashId] ?? 0) + sum;
  }
  return result;
}

export interface SimulationResult {
  baseMonths: number;
  newMonths: number;
  monthsSaved: number;
  baseInterest: number;
  newInterest: number;
  interestSaved: number;
  fee: number;
  netSaving: number;
  newPayoffDate: string | null;
}

function totalInterest(rows: ScheduleRow[]): number {
  return rows.reduce((s, r) => s + r.interest, 0);
}

/** 중도상환수수료. 면제 시점이 지났으면 0. */
export function prepaymentFee(loan: Loan, amount: number, atMs: number): number {
  if (loan.feeWaiverDate && atMs >= dateMs(loan.feeWaiverDate)) return 0;
  return (Math.max(0, amount) * loan.prepaymentFeePct) / 100;
}

/** "월 상환액 +N원" 또는 "지금 N원 중도상환" 시뮬레이션(잔액 기준일 시점 기준). */
export function simulate(loan: Loan, options: ScheduleOptions, atMs: number): SimulationResult {
  const base = buildSchedule(loan);
  const changed = buildSchedule(loan, options);
  const baseInterest = totalInterest(base);
  const newInterest = totalInterest(changed);
  const fee = prepaymentFee(loan, Math.min(options.prepayNow ?? 0, loan.balance), atMs);
  return {
    baseMonths: base.length,
    newMonths: changed.length,
    monthsSaved: base.length - changed.length,
    baseInterest,
    newInterest,
    interestSaved: baseInterest - newInterest,
    fee,
    netSaving: baseInterest - newInterest - fee,
    newPayoffDate: changed.length ? changed[changed.length - 1]!.date : null,
  };
}

/** 지금 시점 기준으로 다시 잡은 대출(시뮬레이션은 현재 잔액에서 출발해야 하므로). */
export function rebaseLoanAt(loan: Loan, atMs: number, isoToday: string): Loan {
  const state = loanStateAt(loan, atMs);
  if (!state.active || isoToday <= loan.balanceAsOf) return loan;
  return { ...loan, balance: state.balance, balanceAsOf: isoToday };
}
