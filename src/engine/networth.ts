// 자산 + 대출을 합친 순자산 계산(기준 시각 인자).
// 순자산 = 자산 − 대출 잔액 − 미납 누적 이자. 연결 현금 항목은 월 상환액만큼 차감된다.

import type { Asset } from '../data/assets';
import type { Loan } from '../data/loans';
import type { TaxRateTable } from '../data/taxRates';
import { valuePortfolio, type Amounts, type Portfolio } from './interest';
import { buildSchedule, cashDeductionsAt, loanStateAt, type LoanState, type ScheduleRow } from './loan';

export interface LoanSnapshot {
  loan: Loan;
  schedule: ScheduleRow[];
  state: LoanState;
}

export interface NetWorth {
  portfolio: Portfolio;
  loans: LoanSnapshot[];
  debt: { principal: number; accrued: number; total: number; perMs: number };
  net: Amounts;
  /** 이자 순증가 속도(자산 이자 − 대출 이자). */
  perMs: Amounts;
}

export function computeNetWorth(
  input: { assets: readonly Asset[]; loans: readonly Loan[]; taxRates: TaxRateTable },
  atMs: number,
): NetWorth {
  const cashAsOf = Object.fromEntries(input.assets.filter((a) => a.type === 'cash').map((a) => [a.id, a.asOfDate]));
  const deductions = cashDeductionsAt(input.loans, cashAsOf, atMs);
  const portfolio = valuePortfolio(input.assets, input.taxRates, atMs, deductions);
  const loans = input.loans.map((loan) => {
    const schedule = buildSchedule(loan);
    return { loan, schedule, state: loanStateAt(loan, atMs, schedule) };
  });
  const principal = loans.reduce((s, l) => s + l.state.balance, 0);
  const accrued = loans.reduce((s, l) => s + l.state.accruedInterest, 0);
  const debtPerMs = loans.reduce((s, l) => s + l.state.perMs, 0);
  const total = principal + accrued;
  return {
    portfolio,
    loans,
    debt: { principal, accrued, total, perMs: debtPerMs },
    net: { gross: portfolio.total.gross - total, net: portfolio.total.net - total },
    perMs: { gross: portfolio.perMs.gross - debtPerMs, net: portfolio.perMs.net - debtPerMs },
  };
}
