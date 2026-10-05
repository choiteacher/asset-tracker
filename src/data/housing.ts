// 분양 일정 데이터 모델. 청약·분양 제도 조건은 코드에 넣지 않고 사용자가 입력한다.

import { isValidIsoDate, MAX_AMOUNT, type IsoDate, type ValidationErrors } from './assets';

export type HousingPaymentKind = 'contract' | 'middle' | 'balance';

export const PAYMENT_KIND_LABELS: Record<HousingPaymentKind, string> = {
  contract: '계약금',
  middle: '중도금',
  balance: '잔금',
};

export interface HousingPayment {
  id: string;
  kind: HousingPaymentKind;
  /** 예: "중도금 1회차" */
  label: string;
  date: IsoDate;
  /** 금액 직접 입력 또는 분양가 대비 비율(%). */
  mode: 'amount' | 'percent';
  value: number;
  /** 이 금액 중 대출로 충당하는 금액(예: 중도금 대출). 자기 자금 필요액 = 금액 − 대출 충당액. */
  loanCovered: number;
  /** 충당하는 대출(4단계 대출 항목, 선택). */
  linkedLoanId: string | null;
}

export interface HousingPlan {
  complexName: string;
  price: number;
  /** 분양(입주) 예정일. */
  expectedDate: IsoDate;
  payments: HousingPayment[];
  memo: string;
}

/** 기본 분양 예정일: 내년 4월 1일(오늘이 1~3월이면 올해 4월). */
export function defaultExpectedDate(today: Date): IsoDate {
  const year = today.getMonth() + 1 >= 4 ? today.getFullYear() + 1 : today.getFullYear();
  return `${year}-04-01`;
}

export function createEmptyHousingPlan(today: Date): HousingPlan {
  return { complexName: '', price: 0, expectedDate: defaultExpectedDate(today), payments: [], memo: '' };
}

export function paymentAmount(plan: HousingPlan, payment: HousingPayment): number {
  return payment.mode === 'percent' ? (plan.price * payment.value) / 100 : payment.value;
}

/** 자기 자금으로 마련해야 하는 금액. */
export function ownFundsNeeded(plan: HousingPlan, payment: HousingPayment): number {
  return Math.max(0, paymentAmount(plan, payment) - payment.loanCovered);
}

export function validateHousingPlan(plan: HousingPlan): { plan: ValidationErrors; payments: Record<string, ValidationErrors> } {
  const errors: ValidationErrors = {};
  if (plan.complexName.length > 100) errors.complexName = '단지명은 100자 이하로 입력하세요.';
  if (!Number.isFinite(plan.price) || plan.price < 0) errors.price = '분양가는 0원 이상의 숫자로 입력하세요.';
  else if (plan.price > MAX_AMOUNT) errors.price = '분양가가 너무 큽니다.';
  if (!isValidIsoDate(plan.expectedDate)) errors.expectedDate = '분양 예정일을 올바른 날짜로 입력하세요.';

  const payments: Record<string, ValidationErrors> = {};
  for (const p of plan.payments) {
    const e: ValidationErrors = {};
    if (!p.label.trim()) e.label = '이름을 입력하세요.';
    if (!isValidIsoDate(p.date)) e.date = '날짜를 입력하세요.';
    if (!Number.isFinite(p.value) || p.value < 0) e.value = '0 이상의 숫자를 입력하세요.';
    else if (p.mode === 'percent' && p.value > 100) e.value = '비율은 100% 이하로 입력하세요.';
    if (!Number.isFinite(p.loanCovered) || p.loanCovered < 0) e.loanCovered = '0 이상의 숫자를 입력하세요.';
    else if (!e.value && p.loanCovered > paymentAmount(plan, p)) e.loanCovered = '대출 충당액이 지급액보다 클 수 없습니다.';
    if (Object.keys(e).length) payments[p.id] = e;
  }
  const percentTotal = plan.payments.filter((p) => p.mode === 'percent').reduce((s, p) => s + p.value, 0);
  if (percentTotal > 100.0001) errors.payments = `비율 합계가 100%를 넘습니다(${percentTotal}%).`;
  return { plan: errors, payments };
}
