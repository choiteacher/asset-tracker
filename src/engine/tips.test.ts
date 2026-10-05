import { describe, expect, it } from 'vitest';
import type { CashAsset, DepositAsset } from '../data/assets';
import type { Loan } from '../data/loans';
import { createDefaultTaxRates } from '../data/taxRates';
import { computeNetWorth } from './networth';
import { buildTips } from './tips';
import { dateMs } from './time';

const STAMP = '2026-01-01T00:00:00.000Z';
const rates = createDefaultTaxRates();
const cash: CashAsset = {
  id: 'c', type: 'cash', name: '가상 통장', institution: '', memo: '', liquidity: 'liquid', unfreezeDate: null,
  asOfDate: '2026-01-01', amount: 1_000_000, createdAt: STAMP, updatedAt: STAMP,
};
const deposit: DepositAsset = {
  id: 'd', type: 'deposit', name: '가상 예금', institution: '가상은행', memo: '', liquidity: 'frozen', unfreezeDate: null,
  asOfDate: '2026-01-01', principal: 10_000_000, annualRatePct: 3.5, startDate: '2025-06-01', maturityDate: '2026-06-01',
  interestPayout: 'atMaturity', taxType: 'general', taxNote: '', createdAt: STAMP, updatedAt: STAMP,
};
const loan: Loan = {
  id: 'l', name: '가상 대출', institution: '가상은행', memo: '', originalAmount: 30_000_000, balance: 30_000_000,
  balanceAsOf: '2026-01-10', annualRatePct: 5, method: 'annuity', monthlyPayment: null, paymentDay: 10,
  startDate: '2026-01-10', maturityDate: '2029-01-10', prepaymentFeePct: 1.2, feeWaiverDate: '2026-05-01',
  linkedCashId: null, createdAt: STAMP, updatedAt: STAMP,
};

function tipsAt(iso: string) {
  const at = dateMs(iso);
  return buildTips(computeNetWorth({ assets: [cash, deposit], loans: [loan], taxRates: rates }, at), rates, at);
}

describe('금융 Tip', () => {
  it('대출 5% > 예금 세후 2.96%면 중도상환 검토 Tip과 근거를 낸다', () => {
    const tip = tipsAt('2026-02-01').find((t) => t.id === 'prepay-vs-savings');
    expect(tip).toBeDefined();
    expect(tip!.body).toMatch(/비상자금/);
    expect(tip!.body).toMatch(/중도상환수수료/);
    expect(tip!.basis.join(' ')).toMatch(/2\.96%/);
  });

  it('면제 시점 90일 이내면 안내, 그보다 멀면 안내하지 않는다', () => {
    expect(tipsAt('2026-02-15').some((t) => t.id === 'fee-waiver-l')).toBe(true);
    expect(tipsAt('2026-01-15').some((t) => t.id === 'fee-waiver-l')).toBe(false);
  });

  it('만기 60일 이내 예금이 있으면 만기 수령액 활용 Tip', () => {
    expect(tipsAt('2026-04-15').some((t) => t.id === 'maturity-d')).toBe(true);
    expect(tipsAt('2026-02-01').some((t) => t.id === 'maturity-d')).toBe(false);
  });

  it('유동자산이 월 상환액 3개월치보다 적으면 경고', () => {
    const tip = tipsAt('2026-02-01').find((t) => t.id === 'low-liquidity');
    expect(tip?.level).toBe('warn');
  });
});
