// 규칙 기반 금융 Tip. 투자 자문이 아니며, 어떤 숫자를 비교했는지(근거)를 함께 돌려준다.

import { hasMaturity, isInterestBearing } from '../data/assets';
import { REPAYMENT_LABELS } from '../data/loans';
import type { TaxRateTable } from '../data/taxRates';
import { formatMoney } from '../utils/format';
import type { NetWorth } from './networth';
import { maturityPayout } from './interest';
import { daysUntil } from './time';

export interface Tip {
  id: string;
  level: 'info' | 'warn';
  title: string;
  body: string;
  /** 계산 근거(비교한 숫자). */
  basis: string[];
}

export const FEE_WAIVER_SOON_DAYS = 90;
export const MATURITY_SOON_DAYS = 60;
/** 유동자산이 월 상환액 합계의 몇 배 미만이면 부족 경고를 낼지. */
export const LIQUIDITY_MONTHS = 3;

const won = (v: number) => `${formatMoney(v)}원`;
const pct = (v: number) => `${v.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%`;

export function buildTips(nw: NetWorth, taxRates: TaxRateTable, nowMs: number): Tip[] {
  const tips: Tip[] = [];
  const activeLoans = nw.loans.filter((l) => l.state.active);
  const savingsItems = nw.portfolio.items.filter((v) => isInterestBearing(v.asset) && !v.matured);
  const liquid = nw.portfolio.liquid.net;

  // 1. 대출 금리 > 예적금 세후 금리
  if (activeLoans.length && savingsItems.length) {
    const bestSaving = savingsItems
      .map((v) => {
        const a = v.asset as Extract<typeof v.asset, { annualRatePct: number }>;
        return { name: a.name, net: a.annualRatePct * (1 - v.taxRatePct / 100), gross: a.annualRatePct, tax: v.taxRatePct };
      })
      .sort((a, b) => b.net - a.net)[0]!;
    const loan = [...activeLoans].sort((a, b) => b.loan.annualRatePct - a.loan.annualRatePct)[0]!;
    if (loan.loan.annualRatePct > bestSaving.net) {
      tips.push({
        id: 'prepay-vs-savings',
        level: 'info',
        title: '대출 금리가 예적금 세후 금리보다 높습니다',
        body:
          '유동자산 일부로 중도상환하면 이자 부담을 줄일 수 있는지 검토해 보세요. 단, 중도상환수수료와 비상자금(생활비 몇 달치)은 먼저 확보해야 하고, 분양 대금 일정도 함께 확인하세요.',
        basis: [
          `가장 높은 대출 금리: ${loan.loan.name} ${pct(loan.loan.annualRatePct)}`,
          `가장 높은 예적금 세후 금리: ${bestSaving.name} ${pct(bestSaving.gross)} × (1 − 세율 ${pct(bestSaving.tax)}) = ${pct(bestSaving.net)}`,
          `중도상환수수료율: ${pct(loan.loan.prepaymentFeePct)}${loan.loan.feeWaiverDate ? ` (면제 시점 ${loan.loan.feeWaiverDate})` : ''}`,
          `현재 유동자산(세후): ${won(liquid)}`,
        ],
      });
    }
  }

  // 2. 중도상환수수료 면제 시점 임박
  for (const { loan, state } of activeLoans) {
    if (!loan.feeWaiverDate || loan.prepaymentFeePct <= 0) continue;
    const days = daysUntil(loan.feeWaiverDate, nowMs);
    if (days >= 0 && days <= FEE_WAIVER_SOON_DAYS) {
      tips.push({
        id: `fee-waiver-${loan.id}`,
        level: 'info',
        title: `${loan.name}: 중도상환수수료 면제까지 ${days}일`,
        body: '중도상환을 계획 중이라면 면제 시점 이후에 하면 수수료를 아낄 수 있습니다.',
        basis: [
          `면제 시점: ${loan.feeWaiverDate} (D-${days})`,
          `지금 잔액 전액 상환 시 수수료: ${won(state.balance)} × ${pct(loan.prepaymentFeePct)} = ${won((state.balance * loan.prepaymentFeePct) / 100)}`,
        ],
      });
    }
  }

  // 3. 만기 임박 예적금 → 대출 줄이기
  if (activeLoans.length) {
    for (const v of nw.portfolio.items) {
      const a = v.asset;
      if (!hasMaturity(a)) continue;
      const days = daysUntil(a.maturityDate, nowMs);
      if (days < 0 || days > MATURITY_SOON_DAYS) continue;
      const payout = maturityPayout(a, taxRates);
      const loan = [...activeLoans].sort((x, y) => y.loan.annualRatePct - x.loan.annualRatePct)[0]!;
      tips.push({
        id: `maturity-${a.id}`,
        level: 'info',
        title: `${a.name} 만기 D-${days}: 만기 수령액 활용 검토`,
        body: `만기 수령액으로 대출 원금을 줄이는 방안을 검토해 보세요. 분양 대금·비상자금 필요 시점과 중도상환수수료를 함께 따져보세요.`,
        basis: [
          `만기일: ${a.maturityDate}, 예상 수령액(세후): ${payout ? won(payout.valueNet) : '-'}`,
          `금리가 가장 높은 대출: ${loan.loan.name} ${pct(loan.loan.annualRatePct)} (${REPAYMENT_LABELS[loan.loan.method]}), 잔액 ${won(loan.state.balance)}`,
        ],
      });
    }
  }

  // 4. 유동자산 부족 가능성
  const monthlyPayments = activeLoans.reduce((s, l) => s + (l.state.next?.payment ?? 0), 0);
  if (monthlyPayments > 0 && liquid < monthlyPayments * LIQUIDITY_MONTHS) {
    tips.push({
      id: 'low-liquidity',
      level: 'warn',
      title: '유동자산이 부족할 수 있습니다',
      body: `유동자산이 대출 월 상환액 ${LIQUIDITY_MONTHS}개월치보다 적습니다. 상환일 전에 입출금 잔액을 확인하세요.`,
      basis: [
        `유동자산(세후): ${won(liquid)}`,
        `다음 달 상환 예정액 합계: ${won(monthlyPayments)} × ${LIQUIDITY_MONTHS}개월 = ${won(monthlyPayments * LIQUIDITY_MONTHS)}`,
      ],
    });
  }

  return tips;
}
