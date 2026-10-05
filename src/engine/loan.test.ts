// 검증 방식: 고정 기준 시각 + 가상 대출. 원리금균등은 공식값과, 원금균등·만기일시는 손계산과 비교한다.

import { describe, expect, it } from 'vitest';
import type { CashAsset } from '../data/assets';
import type { Loan } from '../data/loans';
import { createDefaultTaxRates } from '../data/taxRates';
import { annuityPayment, buildSchedule, loanStateAt, paymentDates, prepaymentFee, simulate } from './loan';
import { computeNetWorth } from './networth';
import { dateMs, YEAR_MS } from './time';

const STAMP = '2026-01-01T00:00:00.000Z';
const base: Loan = {
  id: 'l1',
  name: '가상 대출',
  institution: '가상은행',
  memo: '',
  originalAmount: 12_000_000,
  balance: 12_000_000,
  balanceAsOf: '2026-01-10',
  annualRatePct: 6,
  method: 'equalPrincipal',
  monthlyPayment: null,
  paymentDay: 10,
  startDate: '2026-01-10',
  maturityDate: '2027-01-10',
  prepaymentFeePct: 1.2,
  feeWaiverDate: '2029-01-10',
  linkedCashId: null,
  createdAt: STAMP,
  updatedAt: STAMP,
};

describe('상환 스케줄', () => {
  it('상환일: 기준일 다음 달부터 만기까지 12회', () => {
    const dates = paymentDates(base);
    expect(dates).toHaveLength(12);
    expect(dates[0]).toBe('2026-02-10');
    expect(dates[11]).toBe('2027-01-10');
  });

  it('원금균등: 매월 원금 100만 원 + 잔액 × 0.5% 이자', () => {
    const rows = buildSchedule(base);
    expect(rows[0]).toMatchObject({ principal: 1_000_000, interest: 60_000, balance: 11_000_000 });
    expect(rows[1]!.interest).toBeCloseTo(55_000, 6);
    expect(rows[11]!.balance).toBe(0);
    // 이자 합계 = 0.5% × (1,200만 + 1,100만 + … + 100만) = 0.005 × 7,800만
    expect(rows.reduce((s, r) => s + r.interest, 0)).toBeCloseTo(390_000, 4);
  });

  it('원리금균등: 매월 같은 금액(공식값)이고 마지막에 잔액 0', () => {
    const loan: Loan = { ...base, method: 'annuity' };
    const pay = annuityPayment(12_000_000, 6, 12);
    expect(pay).toBeCloseTo(1_032_797.16, 1);
    const rows = buildSchedule(loan);
    expect(rows).toHaveLength(12);
    for (const r of rows.slice(0, 11)) expect(r.payment).toBeCloseTo(pay, 4);
    expect(rows[11]!.balance).toBe(0);
  });

  it('원리금균등 직접 입력 월 상환액이 크면 더 빨리 끝난다', () => {
    const rows = buildSchedule({ ...base, method: 'annuity', monthlyPayment: 2_100_000 });
    expect(rows.length).toBe(6);
    expect(rows[rows.length - 1]!.balance).toBe(0);
  });

  it('만기일시: 매월 이자 6만 원, 마지막에 원금 전액', () => {
    const rows = buildSchedule({ ...base, method: 'bullet' });
    expect(rows[0]).toMatchObject({ principal: 0, interest: 60_000 });
    expect(rows[11]).toMatchObject({ principal: 12_000_000, balance: 0 });
  });
});

describe('기준 시각의 대출 상태', () => {
  it('상환일이 지나면 잔액이 줄고, 그 뒤 쌓인 이자는 미납 이자로 계산된다', () => {
    const at = dateMs('2026-03-20');
    const s = loanStateAt(base, at);
    expect(s.balance).toBe(10_000_000); // 2/10, 3/10 두 번 상환
    expect(s.paidInterest).toBeCloseTo(115_000, 6);
    expect(s.accruedInterest).toBeCloseTo((10_000_000 * 0.06 * (10 * 86_400_000)) / YEAR_MS, 6);
    expect(s.next?.date).toBe('2026-04-10');
    expect(s.remainingMonths).toBe(10);
    expect(s.payoff?.date).toBe('2027-01-10');
  });

  it('시작 전 대출(예: 예정된 중도금 대출)은 부채 0', () => {
    const s = loanStateAt({ ...base, startDate: '2027-01-10', balanceAsOf: '2027-01-10', maturityDate: '2030-01-10' }, dateMs('2026-06-01'));
    expect(s.balance).toBe(0);
    expect(s.active).toBe(false);
  });
});

describe('시뮬레이션', () => {
  it('월 +100만 원 추가 상환 시 기간 단축·이자 절감', () => {
    const r = simulate(base, { extraMonthly: 1_000_000 }, dateMs('2026-01-10'));
    expect(r.newMonths).toBe(6);
    expect(r.monthsSaved).toBe(6);
    expect(r.interestSaved).toBeGreaterThan(0);
    expect(r.fee).toBe(0);
  });

  it('지금 600만 원 중도상환: 수수료 1.2% = 72,000원을 빼고 순절감액 계산', () => {
    const r = simulate(base, { prepayNow: 6_000_000 }, dateMs('2026-01-10'));
    expect(r.fee).toBeCloseTo(72_000, 6);
    expect(r.newMonths).toBe(6);
    expect(r.netSaving).toBeCloseTo(r.interestSaved - 72_000, 6);
  });

  it('면제 시점이 지나면 수수료 0', () => {
    expect(prepaymentFee(base, 1_000_000, dateMs('2029-01-10'))).toBe(0);
    expect(prepaymentFee({ ...base, feeWaiverDate: null }, 1_000_000, dateMs('2035-01-01'))).toBeCloseTo(12_000, 6);
  });
});

describe('순자산 반영', () => {
  const cash: CashAsset = {
    id: 'c1',
    type: 'cash',
    name: '가상 통장',
    institution: '',
    memo: '',
    liquidity: 'liquid',
    unfreezeDate: null,
    asOfDate: '2026-01-10',
    amount: 20_000_000,
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  const rates = createDefaultTaxRates();

  it('순자산 = 자산 − 잔액 − 미납 이자', () => {
    const at = dateMs('2026-03-20');
    const nw = computeNetWorth({ assets: [cash], loans: [base], taxRates: rates }, at);
    const s = loanStateAt(base, at);
    expect(nw.debt.total).toBeCloseTo(s.balance + s.accruedInterest, 6);
    expect(nw.net.net).toBeCloseTo(20_000_000 - s.balance - s.accruedInterest, 6);
  });

  it('연결 현금이 있으면 상환액만큼 현금도 줄어 순자산이 부풀지 않는다', () => {
    const at = dateMs('2026-03-20');
    const linked = { ...base, linkedCashId: 'c1' };
    const nw = computeNetWorth({ assets: [cash], loans: [linked], taxRates: rates }, at);
    const paid = 1_060_000 + 1_055_000;
    expect(nw.portfolio.total.gross).toBeCloseTo(20_000_000 - paid, 6);
    // 상환 직전과 직후의 순자산 차이 = 그 달 이자만큼만 줄어듦(원금 상환은 자산·부채가 같이 줄어 상쇄)
    const before = computeNetWorth({ assets: [cash], loans: [linked], taxRates: rates }, dateMs('2026-02-10') - 1);
    const after = computeNetWorth({ assets: [cash], loans: [linked], taxRates: rates }, dateMs('2026-02-10'));
    expect(before.net.net - after.net.net).toBeCloseTo(60_000 - before.debt.accrued, 0);
  });
});
