// 검증 방식: "지금" 시각을 고정하고, 미래 날짜의 예측값을 손계산과 비교한다. 모든 숫자는 가상값.

import { describe, expect, it } from 'vitest';
import type { CashAsset, DepositAsset, SavingsAsset, ValuedAsset } from '../data/assets';
import { createEmptyHousingPlan, type HousingPlan } from '../data/housing';
import type { Loan } from '../data/loans';
import { createDefaultTaxRates } from '../data/taxRates';
import { checkHousingPayments, forecastAt, monthlyForecast, summarizeHousing } from './forecast';
import { dateMs } from './time';

const STAMP = '2026-01-01T00:00:00.000Z';
const rates = createDefaultTaxRates();
const NOW = dateMs('2026-10-05') + 9 * 3600_000;
const common = { memo: '', unfreezeDate: null, createdAt: STAMP, updatedAt: STAMP, institution: '가상은행' };

const cash: CashAsset = { ...common, id: 'cash', type: 'cash', name: '가상 통장', liquidity: 'liquid', asOfDate: '2026-10-05', amount: 10_000_000 };
const stock: ValuedAsset = { ...common, id: 'stk', type: 'stock', name: '가상 주식', liquidity: 'liquid', asOfDate: '2026-10-05', valuation: 5_000_000 };
const deposit: DepositAsset = {
  ...common,
  id: 'dep',
  type: 'deposit',
  name: '가상 예금',
  liquidity: 'frozen',
  asOfDate: '2026-10-05',
  principal: 20_000_000,
  annualRatePct: 0,
  startDate: '2026-01-01',
  maturityDate: '2027-01-01',
  interestPayout: 'atMaturity',
  taxType: 'general',
  taxNote: '',
};
const savings: SavingsAsset = {
  ...common,
  id: 'sav',
  type: 'savings',
  name: '가상 적금',
  liquidity: 'frozen',
  asOfDate: '2026-10-05',
  monthlyAmount: 1_000_000,
  annualRatePct: 0,
  startDate: '2026-01-10',
  maturityDate: '2027-07-10',
  paymentDay: 10,
  paidCount: 9, // 2026-10-05 기준 1~9월분 납입
  taxType: 'general',
  taxNote: '',
};
const input = { assets: [cash, stock, deposit, savings], loans: [] as Loan[], taxRates: rates };

describe('미래 시점 예측', () => {
  it('지금: 예금·적금은 동결', () => {
    const f = forecastAt(input, NOW, NOW);
    expect(f.liquid).toBe(15_000_000);
    expect(f.frozen).toBe(29_000_000);
  });

  it('예금 만기(2027-01-01)가 지나면 유동으로 바뀌고, 적금은 매월 납입이 이어진다', () => {
    const f = forecastAt(input, dateMs('2027-02-01'), NOW);
    expect(f.liquid).toBe(35_000_000);
    // 적금: 9회 + 10/10, 11/10, 12/10, 1/10 = 13회
    expect(f.frozen).toBe(13_000_000);
  });

  it('분양 시점에 쓸 수 없는 자산은 활용 가능 유동자산에서 뺀다', () => {
    const f = forecastAt({ ...input, assets: [cash, { ...stock, housingUsable: false }] }, NOW, NOW);
    expect(f.liquid).toBe(15_000_000);
    expect(f.usableLiquid).toBe(10_000_000);
  });

  it('만약에: 월 50만 원 추가 저축, 월 20만 원 지출 증가 → 4개월 뒤 +120만 원', () => {
    const f = forecastAt(input, dateMs('2027-02-05'), NOW, { monthlyExtraSaving: 500_000, monthlyExtraExpense: 200_000 });
    expect(f.whatIfDelta).toBe(1_200_000);
  });

  it('대출은 스케줄대로 줄어든다', () => {
    const loan: Loan = {
      id: 'l', name: '가상 대출', institution: '', memo: '', originalAmount: 12_000_000, balance: 12_000_000,
      balanceAsOf: '2026-10-01', annualRatePct: 0, method: 'equalPrincipal', monthlyPayment: null, paymentDay: 1,
      startDate: '2026-10-01', maturityDate: '2027-10-01', prepaymentFeePct: 0, feeWaiverDate: null, linkedCashId: null,
      createdAt: STAMP, updatedAt: STAMP,
    };
    expect(forecastAt({ ...input, loans: [loan] }, dateMs('2027-01-15'), NOW).debt).toBe(9_000_000);
  });
});

describe('분양 지급 일정 판정', () => {
  const plan: HousingPlan = {
    ...createEmptyHousingPlan(new Date(NOW)),
    price: 500_000_000,
    expectedDate: '2027-04-01',
    payments: [
      { id: 'p1', kind: 'contract', label: '계약금', date: '2026-11-01', mode: 'percent', value: 2, loanCovered: 0, linkedLoanId: null },
      { id: 'p2', kind: 'middle', label: '중도금 1회', date: '2027-02-01', mode: 'amount', value: 50_000_000, loanCovered: 40_000_000, linkedLoanId: null },
      { id: 'p3', kind: 'balance', label: '잔금', date: '2027-04-01', mode: 'amount', value: 40_000_000, loanCovered: 0, linkedLoanId: null },
    ],
  };

  it('지급일마다 필요 금액과 예상 유동자산을 비교하고 앞선 지급분을 뺀다', () => {
    const [c1, c2, c3] = checkHousingPayments(input, plan, NOW);
    // 계약금 2% = 1,000만 / 11월 1일 유동 1,500만 → 여유 500만
    expect(c1).toMatchObject({ amount: 10_000_000, own: 10_000_000, available: 15_000_000, margin: 5_000_000, status: 'ok' });
    // 중도금 자기 자금 1,000만 / 2월 1일 유동 3,500만 − 앞서 낸 1,000만 = 2,500만
    expect(c2).toMatchObject({ own: 10_000_000, loanCovered: 40_000_000, available: 25_000_000, status: 'ok' });
    // 잔금 4,000만 / 4월 1일 유동 3,500만 − 2,000만 = 1,500만 → 부족 2,500만
    expect(c3).toMatchObject({ own: 40_000_000, available: 15_000_000, shortfall: 25_000_000, status: 'short' });
  });

  it('요약: 가장 빠듯한 시점과 부족액, 남은 일수', () => {
    const s = summarizeHousing(input, plan, NOW);
    expect(s.tightest?.payment.id).toBe('p3');
    expect(s.tightestMargin).toBe(-25_000_000);
    expect(s.totalOwnRemaining).toBe(60_000_000);
    expect(s.daysLeft).toBe(178);
  });

  it('만약에 월 300만 원 추가 저축이면 잔금 부족이 해소된다(5개월 × 300만 = 1,500만 … 아직 부족 1,000만)', () => {
    const c3 = checkHousingPayments(input, plan, NOW, { monthlyExtraSaving: 3_000_000, monthlyExtraExpense: 0 })[2]!;
    expect(c3.shortfall).toBe(10_000_000);
  });

  it('부족액은 지급분마다 따로 센다(앞선 부족분을 다시 더하지 않음)', () => {
    const big = { ...plan, payments: [{ ...plan.payments[0]!, value: 4 }, { ...plan.payments[2]!, date: '2026-12-01', value: 10_000_000 }] };
    const [a, b] = checkHousingPayments(input, big, NOW);
    expect(a!.shortfall).toBe(5_000_000); // 2,000만 필요, 1,500만 보유
    expect(b!.shortfall).toBe(10_000_000); // 이미 바닥 → 이번 지급분 1,000만만 부족
  });

  it('이미 지난 지급일은 낸 것으로 본다', () => {
    const past = { ...plan, payments: [{ ...plan.payments[0]!, date: '2026-09-01' }] };
    expect(checkHousingPayments(input, past, NOW)[0]!.status).toBe('paid');
  });

  it('월별 추이: 분양 자기 자금을 낸 뒤 유동자산에서 빠진다', () => {
    const points = monthlyForecast(input, plan, NOW, 7);
    expect(points[0]!.date).toBe('2026-10-05');
    const dec = points.find((p) => p.date === '2026-12-01')!;
    expect(dec.housingPaid).toBe(10_000_000);
    expect(dec.liquid).toBe(5_000_000);
  });
});
