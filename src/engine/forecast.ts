// 미래 시점 예측(순수 함수, 기준 시각과 "지금" 시각을 인자로 받는다).
// 현재 입력 데이터 기반 추정이며, 주식·펀드는 현재 평가금액으로 고정된다고 가정한다.
//  - 만기·동결 해제일이 지나면 동결자산이 유동으로 바뀐다.
//  - 적금은 납입일마다 계속 납입한다고 보고, 대출은 스케줄대로 상환된다(연결 현금에서 차감).
//  - "만약에" 월 추가 저축/지출 변동은 지금부터 그 시점까지 지난 달 수만큼 유동자산에 더하거나 뺀다.
//  - 분양 대금으로 낸 자기 자금은 유동자산에서 빠지고, 순자산에는 "분양 납입액(취득 원가)"으로 남긴다.

import { monthsBetween, type Asset } from '../data/assets';
import { ownFundsNeeded, paymentAmount, type HousingPayment, type HousingPlan } from '../data/housing';
import type { Loan } from '../data/loans';
import type { TaxRateTable } from '../data/taxRates';
import { computeNetWorth } from './networth';
import { dateMs, isoFromMs, monthDate, startOfDay } from './time';

export interface ForecastInput {
  assets: readonly Asset[];
  loans: readonly Loan[];
  taxRates: TaxRateTable;
}

export interface WhatIf {
  /** 매월 추가로 모으는 돈(원). */
  monthlyExtraSaving: number;
  /** 매월 늘어나는 지출(원). 줄어들면 음수. */
  monthlyExtraExpense: number;
}

export const NO_WHAT_IF: WhatIf = { monthlyExtraSaving: 0, monthlyExtraExpense: 0 };

export interface Forecast {
  atMs: number;
  liquid: number;
  frozen: number;
  debt: number;
  /** 유동자산 중 "분양 시점 활용 가능"으로 표시된 것(+ 만약에 조정). */
  usableLiquid: number;
  /** 만약에 입력으로 더해진 금액. */
  whatIfDelta: number;
  net: number;
}

/** 지금부터 그 시점까지 지난 달 수(일 기준). */
function monthsFromNow(nowMs: number, atMs: number): number {
  if (atMs <= nowMs) return 0;
  return monthsBetween(isoFromMs(nowMs), isoFromMs(atMs));
}

export function forecastAt(input: ForecastInput, atMs: number, nowMs: number, whatIf: WhatIf = NO_WHAT_IF): Forecast {
  const nw = computeNetWorth(input, atMs);
  let liquid = 0;
  let frozen = 0;
  let usable = 0;
  for (const item of nw.portfolio.items) {
    if (item.liquid) {
      liquid += item.valueNet;
      if (item.asset.housingUsable !== false) usable += item.valueNet;
    } else {
      frozen += item.valueNet;
    }
  }
  const whatIfDelta = monthsFromNow(nowMs, atMs) * (whatIf.monthlyExtraSaving - whatIf.monthlyExtraExpense);
  liquid += whatIfDelta;
  usable += whatIfDelta;
  const debt = nw.debt.total;
  return { atMs, liquid, frozen, debt, usableLiquid: usable, whatIfDelta, net: liquid + frozen - debt };
}

export type PaymentStatus = 'paid' | 'ok' | 'short';

export interface PaymentCheck {
  payment: HousingPayment;
  amount: number;
  loanCovered: number;
  /** 자기 자금 필요액. */
  own: number;
  /** 그 날짜의 예상 활용 가능 유동자산 − 앞선 지급분. */
  available: number;
  shortfall: number;
  /** 여유 = available − own (음수면 부족). */
  margin: number;
  status: PaymentStatus;
}

export function sortedPayments(plan: HousingPlan): HousingPayment[] {
  return [...plan.payments].sort((a, b) => a.date.localeCompare(b.date));
}

/** 지급일마다 "필요 금액 vs 예상 유동자산"을 비교한다. 오늘 이전 지급분은 이미 낸 것으로 본다. */
export function checkHousingPayments(input: ForecastInput, plan: HousingPlan, nowMs: number, whatIf: WhatIf = NO_WHAT_IF): PaymentCheck[] {
  const today = startOfDay(nowMs);
  let spent = 0;
  return sortedPayments(plan).map((payment) => {
    const amount = paymentAmount(plan, payment);
    const own = ownFundsNeeded(plan, payment);
    const loanCovered = amount - own;
    if (dateMs(payment.date) < today) {
      return { payment, amount, loanCovered, own, available: 0, shortfall: 0, margin: 0, status: 'paid' as const };
    }
    const f = forecastAt(input, dateMs(payment.date), nowMs, whatIf);
    const available = f.usableLiquid - spent;
    spent += own;
    const margin = available - own;
    return {
      payment,
      amount,
      loanCovered,
      own,
      available,
      // 앞선 지급일에서 이미 부족했던 금액은 다시 세지 않는다(이번 지급분만큼의 부족액).
      shortfall: Math.max(0, own - Math.max(0, available)),
      margin,
      status: margin < 0 ? ('short' as const) : ('ok' as const),
    };
  });
}

export interface HousingSummary {
  daysLeft: number;
  /** 분양 예정일의 예상 순자산(분양 납입액 포함). */
  netAtExpected: number;
  totalOwnRemaining: number;
  /** 가장 빠듯한 지급 시점의 여유(음수면 부족). 남은 지급이 없으면 null. */
  tightestMargin: number | null;
  tightest: PaymentCheck | null;
  checks: PaymentCheck[];
}

export function summarizeHousing(input: ForecastInput, plan: HousingPlan, nowMs: number, whatIf: WhatIf = NO_WHAT_IF): HousingSummary {
  const checks = checkHousingPayments(input, plan, nowMs, whatIf);
  const upcoming = checks.filter((c) => c.status !== 'paid');
  const tightest = upcoming.length ? upcoming.reduce((a, b) => (b.margin < a.margin ? b : a)) : null;
  const expectedMs = dateMs(plan.expectedDate);
  const f = forecastAt(input, expectedMs, nowMs, whatIf);
  return {
    daysLeft: Math.round((startOfDay(expectedMs) - startOfDay(nowMs)) / 86_400_000),
    // 낸 분양 대금은 유동자산에서 빠지지만 분양권(취득 원가)으로 남으므로 순자산은 그대로 둔다.
    netAtExpected: f.net,
    totalOwnRemaining: upcoming.reduce((s, c) => s + c.own, 0),
    tightestMargin: tightest ? tightest.margin : null,
    tightest,
    checks,
  };
}

export interface MonthlyPoint {
  date: string;
  liquid: number;
  frozen: number;
  debt: number;
  net: number;
  /** 그 시점까지 낸 분양 자기 자금 누계. */
  housingPaid: number;
}

/** 오늘부터 매월 1일 간격의 예상 추이(최대 months개월). 분양 자기 자금 납부는 유동자산에서 뺀다. */
export function monthlyForecast(
  input: ForecastInput,
  plan: HousingPlan | null,
  nowMs: number,
  months: number,
  whatIf: WhatIf = NO_WHAT_IF,
): MonthlyPoint[] {
  const todayIso = isoFromMs(nowMs);
  const dates = [todayIso];
  for (let k = 1; k <= months; k++) dates.push(monthDate(todayIso, k, 1));
  const today = startOfDay(nowMs);
  const upcoming = plan ? sortedPayments(plan).filter((p) => dateMs(p.date) >= today) : [];
  return dates.map((date, i) => {
    const atMs = i === 0 ? nowMs : dateMs(date);
    const f = forecastAt(input, atMs, nowMs, whatIf);
    const housingPaid = plan ? upcoming.filter((p) => dateMs(p.date) <= atMs).reduce((s, p) => s + ownFundsNeeded(plan, p), 0) : 0;
    return { date, liquid: f.liquid - housingPaid, frozen: f.frozen, debt: f.debt, net: f.net, housingPaid };
  });
}

/** 그래프 기간: 분양 예정일·마지막 지급일 다음 달까지(최소 6개월, 최대 60개월). */
export function forecastMonths(plan: HousingPlan | null, nowMs: number): number {
  const todayIso = isoFromMs(nowMs);
  let last = plan?.expectedDate ?? todayIso;
  for (const p of plan?.payments ?? []) if (p.date > last) last = p.date;
  return Math.min(60, Math.max(6, monthsBetween(todayIso, last) + 2));
}
