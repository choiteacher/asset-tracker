// 테스트 전용 가상 자산. 실제 데이터가 아니다.
import type { CashAsset, DepositAsset, SavingsAsset, SubscriptionAsset, ValuedAsset } from './assets';

const STAMP = '2026-01-15T00:00:00.000Z';
const base = { memo: '', unfreezeDate: null, asOfDate: '2026-01-15', createdAt: STAMP, updatedAt: STAMP };

export const sampleDeposit: DepositAsset = {
  ...base,
  id: 'dep-1',
  type: 'deposit',
  name: '가상 정기예금',
  institution: '가상은행',
  liquidity: 'frozen',
  principal: 10_000_000,
  annualRatePct: 3.5,
  startDate: '2026-01-10',
  maturityDate: '2027-01-10',
  interestPayout: 'atMaturity',
  taxType: 'general',
  taxNote: '',
};

export const sampleSavings: SavingsAsset = {
  ...base,
  id: 'sav-1',
  type: 'savings',
  name: '가상 정기적금',
  institution: '가상은행',
  liquidity: 'frozen',
  monthlyAmount: 500_000,
  annualRatePct: 4,
  startDate: '2026-01-10',
  maturityDate: '2027-01-10',
  paymentDay: 10,
  paidCount: 3,
  taxType: 'mutualPreferential',
  taxNote: '가상 한도 메모',
};

export const sampleSubscription: SubscriptionAsset = {
  ...base,
  id: 'sub-1',
  type: 'subscription',
  name: '가상 청약저축',
  institution: '가상은행',
  liquidity: 'frozen',
  totalPaid: 2_400_000,
  monthlyAmount: 100_000,
  annualRatePct: 2.3,
  startDate: '2024-01-05',
  taxType: 'general',
  taxNote: '',
};

export const sampleStock: ValuedAsset = {
  ...base,
  id: 'stk-1',
  type: 'stock',
  name: '가상 주식계좌',
  institution: '가상증권',
  liquidity: 'liquid',
  valuation: 3_210_000,
};

export const sampleCash: CashAsset = {
  ...base,
  id: 'csh-1',
  type: 'cash',
  name: '가상 입출금통장',
  institution: '가상은행',
  liquidity: 'liquid',
  amount: 1_234_567,
};

export const sampleAssets = [sampleDeposit, sampleSavings, sampleSubscription, sampleStock, sampleCash];
