import { describe, expect, it } from 'vitest';
import { sampleDeposit } from '../data/fixtures';
import type { HousingPlan } from '../data/housing';
import type { Loan } from '../data/loans';
import { buildAlerts } from './alerts';
import { dateMs } from './time';

const loan: Loan = {
  id: 'l', name: '가상 대출', institution: '', memo: '', originalAmount: 1_000_000, balance: 1_000_000,
  balanceAsOf: '2026-12-01', annualRatePct: 5, method: 'bullet', monthlyPayment: null, paymentDay: 10,
  startDate: '2026-12-01', maturityDate: '2027-12-10', prepaymentFeePct: 0, feeWaiverDate: null, linkedCashId: null,
  createdAt: '', updatedAt: '',
};
const housing: HousingPlan = {
  complexName: '', price: 100, expectedDate: '2027-04-01', memo: '',
  payments: [{ id: 'p', kind: 'contract', label: '계약금', date: '2027-02-01', mode: 'amount', value: 10, loanCovered: 0, linkedLoanId: null }],
};

describe('D-day 알림', () => {
  it('만기 60일·상환일 14일·분양 지급 90일 이내만, 가까운 순으로', () => {
    // 예금 만기 2027-01-10, 대출 다음 상환 2026-12-10, 계약금 2027-02-01
    const alerts = buildAlerts({ assets: [sampleDeposit], loans: [loan], housing }, dateMs('2026-12-01'));
    expect(alerts.map((a) => [a.kind, a.days])).toEqual([
      ['loan', 9],
      ['maturity', 40],
      ['housing', 62],
    ]);
  });

  it('기간 밖이나 지난 일정은 제외', () => {
    expect(buildAlerts({ assets: [sampleDeposit], loans: [loan], housing }, dateMs('2026-09-01'))).toEqual([]);
    expect(buildAlerts({ assets: [sampleDeposit], loans: [], housing: null }, dateMs('2027-01-11'))).toEqual([]);
  });
});
