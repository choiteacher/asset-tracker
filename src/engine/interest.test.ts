// 검증 방식: 기준 시각을 고정하고(현지 자정 기준 dateMs), 손으로 계산한 기대값과 비교한다.
// 금리를 3.65%로 두면 "1원당 하루 이자 = 0.0001원"이 되어 기대값을 암산으로 확인할 수 있다. 모든 숫자는 가상값.

import { describe, expect, it } from 'vitest';
import type { DepositAsset, SavingsAsset, SubscriptionAsset } from '../data/assets';
import { sampleCash, sampleStock } from '../data/fixtures';
import { createDefaultTaxRates } from '../data/taxRates';
import { isLiquidAt, maturityPayout, savingsSchedule, valueAsset, valuePortfolio } from './interest';
import { DAY_MS, dateMs, monthDate, monthlyDatesBetween, daysUntil } from './time';

const rates = createDefaultTaxRates(); // 일반 15.4%
const STAMP = '2026-01-01T00:00:00.000Z';
const common = { memo: '', unfreezeDate: null, createdAt: STAMP, updatedAt: STAMP, institution: '가상은행' };

const deposit: DepositAsset = {
  ...common,
  id: 'd',
  type: 'deposit',
  name: '가상 예금',
  liquidity: 'frozen',
  asOfDate: '2026-01-01',
  principal: 10_000_000,
  annualRatePct: 3.65,
  startDate: '2026-01-01',
  maturityDate: '2027-01-01',
  interestPayout: 'atMaturity',
  taxType: 'general',
  taxNote: '',
};

const savings: SavingsAsset = {
  ...common,
  id: 's',
  type: 'savings',
  name: '가상 적금',
  liquidity: 'frozen',
  asOfDate: '2026-03-15',
  monthlyAmount: 1_000_000,
  annualRatePct: 3.65,
  startDate: '2026-01-01',
  maturityDate: '2027-01-01',
  paymentDay: 1,
  paidCount: 3,
  taxType: 'taxFree',
  taxNote: '',
};

const subscription: SubscriptionAsset = {
  ...common,
  id: 'c',
  type: 'subscription',
  name: '가상 청약',
  liquidity: 'frozen',
  asOfDate: '2026-01-15',
  totalPaid: 2_400_000,
  monthlyAmount: 100_000,
  annualRatePct: 3.65,
  startDate: '2020-03-05',
  taxType: 'general',
  taxNote: '',
};

describe('날짜 도우미', () => {
  it('말일 보정', () => {
    expect(monthDate('2026-01-31', 1, 31)).toBe('2026-02-28');
    expect(monthDate('2026-11-10', 2, 10)).toBe('2027-01-10');
  });

  it('기간 안의 매월 날짜', () => {
    expect(monthlyDatesBetween('2026-01-15', 5, '2026-04-05')).toEqual(['2026-02-05', '2026-03-05', '2026-04-05']);
    expect(monthlyDatesBetween('2026-01-04', 5, '2026-01-31')).toEqual(['2026-01-05']);
  });

  it('D-day', () => {
    const now = dateMs('2026-10-05') + 15 * 3600_000;
    expect(daysUntil('2026-10-05', now)).toBe(0);
    expect(daysUntil('2026-10-15', now)).toBe(10);
    expect(daysUntil('2026-10-01', now)).toBe(-4);
  });
});

describe('정기예금', () => {
  it('1년 만기 시 세전 365,000원, 세금 15.4% = 56,210원', () => {
    const v = valueAsset(deposit, rates, dateMs('2027-01-01'));
    expect(v.interestGross).toBeCloseTo(365_000, 6);
    expect(v.tax).toBeCloseTo(56_210, 6);
    expect(v.valueNet).toBeCloseTo(10_308_790, 6);
    expect(v.matured).toBe(true);
  });

  it('초 단위로 증가한다: 하루 1,000원 → 1초 약 0.01157원', () => {
    const t = dateMs('2026-01-11');
    expect(valueAsset(deposit, rates, t).interestGross).toBeCloseTo(10_000, 6);
    expect(valueAsset(deposit, rates, t + 1000).interestGross - 10_000).toBeCloseTo(1000 / 86_400, 8);
    expect(valueAsset(deposit, rates, t).perMsGross * DAY_MS).toBeCloseTo(1000, 6);
  });

  it('만기 이후에는 이자가 늘지 않는다', () => {
    const atMaturity = valueAsset(deposit, rates, dateMs('2027-01-01'));
    const later = valueAsset(deposit, rates, dateMs('2027-06-01'));
    expect(later.interestGross).toBeCloseTo(atMaturity.interestGross, 6);
    expect(later.perMsGross).toBe(0);
  });

  it('가입 전에는 이자 0', () => {
    expect(valueAsset(deposit, rates, dateMs('2025-12-01')).interestGross).toBe(0);
  });

  it('만기 예상 수령액(세후)', () => {
    expect(maturityPayout(deposit, rates)?.valueNet).toBeCloseTo(10_308_790, 6);
    expect(maturityPayout(subscription, rates)).toBeNull();
  });
});

describe('정기적금', () => {
  it('납입 예정일: 1회차 가입일, 이후 매월 납입일, 총 12회', () => {
    const s = savingsSchedule(savings);
    expect(s).toHaveLength(12);
    expect(s[0]).toBe('2026-01-01');
    expect(s[11]).toBe('2026-12-01');
  });

  it('기준일(3/15)까지 낸 3회분만 회차별로 계산하고 미래 회차는 제외한다', () => {
    const v = valueAsset(savings, rates, dateMs('2026-03-15'));
    // 1/1→73일, 2/1→42일, 3/1→14일 = 129일 × 100원
    expect(v.principal).toBe(3_000_000);
    expect(v.interestGross).toBeCloseTo(12_900, 6);
    expect(v.tax).toBe(0); // 비과세
  });

  it('기준일 이후 납입일이 지나면 그 회차가 더해진다', () => {
    const v = valueAsset(savings, rates, dateMs('2026-04-02'));
    expect(v.principal).toBe(4_000_000);
  });

  it('만기 시 12회 전부의 이자 = 238,200원, 이후 증가 중지', () => {
    // 각 회차 납입일~2027-01-01 일수 합 2,382일 × 100원
    const atMaturity = valueAsset(savings, rates, dateMs('2027-01-01'));
    expect(atMaturity.principal).toBe(12_000_000);
    expect(atMaturity.interestGross).toBeCloseTo(238_200, 6);
    const later = valueAsset(savings, rates, dateMs('2027-03-01'));
    expect(later.interestGross).toBeCloseTo(238_200, 6);
    expect(later.principal).toBe(12_000_000);
  });

  it('과세유형 세율이 적용된다(2금융 세금우대 1.4%)', () => {
    const v = valueAsset({ ...savings, taxType: 'mutualPreferential' }, rates, dateMs('2027-01-01'));
    expect(v.tax).toBeCloseTo(238_200 * 0.014, 6);
  });
});

describe('청약저축', () => {
  it('납입 총액에 기준일부터 이자, 이후 매월 납입분 추가', () => {
    const v = valueAsset(subscription, rates, dateMs('2026-02-15'));
    // 240만 × 31일 × 0.0001 = 7,440 + 2/5 납입 10만 × 10일 × 0.0001 = 100
    expect(v.principal).toBe(2_500_000);
    expect(v.interestGross).toBeCloseTo(7_540, 6);
    expect(v.tax).toBeCloseTo(7_540 * 0.154, 6);
  });
});

describe('포트폴리오', () => {
  it('유동/동결을 나누고 과세유형별 세금을 따로 집계한다', () => {
    const at = dateMs('2026-03-15');
    const p = valuePortfolio([deposit, savings, sampleCash, sampleStock], rates, at);
    const dep = valueAsset(deposit, rates, at);
    expect(p.liquid.gross).toBe(sampleCash.amount + sampleStock.valuation);
    expect(p.frozen.gross).toBeCloseTo(dep.valueGross + 3_012_900, 6);
    expect(p.byTax.general.tax).toBeCloseTo(dep.tax, 6);
    expect(p.byTax.taxFree.interest).toBeCloseTo(12_900, 6);
    expect(p.total.net).toBeCloseTo(p.liquid.net + p.frozen.net, 6);
  });

  it('만기·동결 해제일이 지나면 동결자산이 유동으로 바뀐다', () => {
    expect(isLiquidAt(deposit, dateMs('2026-12-31'))).toBe(false);
    expect(isLiquidAt(deposit, dateMs('2027-01-01'))).toBe(true);
    expect(isLiquidAt({ ...subscription, unfreezeDate: '2027-04-01' }, dateMs('2027-04-01'))).toBe(true);
  });

  it('현금은 연결 대출 상환 누계만큼 차감된다', () => {
    const p = valuePortfolio([sampleCash], rates, dateMs('2026-03-15'), { [sampleCash.id]: 200_000 });
    expect(p.total.gross).toBe(sampleCash.amount - 200_000);
  });
});
