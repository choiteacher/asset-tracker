// 대출 데이터 모델과 검증. UI와 무관한 순수 함수.

import { isValidIsoDate, MAX_AMOUNT, MAX_RATE_PCT, type IsoDate, type ValidationErrors } from './assets';
import { josa } from '../utils/josa';

export type RepaymentMethod = 'annuity' | 'equalPrincipal' | 'bullet';

export const REPAYMENT_METHODS: readonly RepaymentMethod[] = ['annuity', 'equalPrincipal', 'bullet'];

export const REPAYMENT_LABELS: Record<RepaymentMethod, string> = {
  annuity: '원리금균등',
  equalPrincipal: '원금균등',
  bullet: '만기일시',
};

export interface Loan {
  id: string;
  name: string;
  institution: string;
  memo: string;
  /** 최초 대출금. */
  originalAmount: number;
  /** 현재 잔액과 그 기준일. 상환 스케줄은 이 시점부터 계산한다. */
  balance: number;
  balanceAsOf: IsoDate;
  annualRatePct: number;
  method: RepaymentMethod;
  /** 월 상환액 직접 입력값(원리금균등만). null이면 자동 계산값 사용. */
  monthlyPayment: number | null;
  /** 매월 상환일(1~31). */
  paymentDay: number;
  startDate: IsoDate;
  maturityDate: IsoDate;
  /** 중도상환수수료율(%)과 면제 시점(선택). */
  prepaymentFeePct: number;
  feeWaiverDate: IsoDate | null;
  /** 월 상환액을 자동 차감할 현금 자산 id(선택). */
  linkedCashId: string | null;
  createdAt: string;
  updatedAt: string;
}

function checkAmount(errors: ValidationErrors, field: string, value: number, label: string) {
  if (!Number.isFinite(value)) errors[field] = `${josa(label, '을/를')} 숫자로 입력하세요.`;
  else if (value < 0) errors[field] = `${josa(label, '은/는')} 0원 이상이어야 합니다.`;
  else if (value > MAX_AMOUNT) errors[field] = `${josa(label, '이/가')} 너무 큽니다.`;
}

export function validateLoan(loan: Loan, cashIds: readonly string[] = []): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!loan.name.trim()) errors.name = '대출명을 입력하세요.';
  else if (loan.name.length > 100) errors.name = '대출명은 100자 이하로 입력하세요.';
  if (loan.institution.length > 100) errors.institution = '금융기관명은 100자 이하로 입력하세요.';
  if (loan.memo.length > 2000) errors.memo = '메모는 2000자 이하로 입력하세요.';
  checkAmount(errors, 'originalAmount', loan.originalAmount, '최초 대출금');
  checkAmount(errors, 'balance', loan.balance, '현재 잔액');
  if (!errors.balance && !errors.originalAmount && loan.balance > loan.originalAmount) {
    errors.balance = '현재 잔액이 최초 대출금보다 클 수 없습니다.';
  }
  if (!Number.isFinite(loan.annualRatePct)) errors.annualRatePct = '연이율을 숫자로 입력하세요.';
  else if (loan.annualRatePct < 0 || loan.annualRatePct > MAX_RATE_PCT) errors.annualRatePct = '연이율은 0~100% 사이여야 합니다.';
  if (!REPAYMENT_METHODS.includes(loan.method)) errors.method = '상환방식을 선택하세요.';
  if (loan.monthlyPayment !== null) {
    checkAmount(errors, 'monthlyPayment', loan.monthlyPayment, '월 상환액');
    if (!errors.monthlyPayment && loan.monthlyPayment === 0) errors.monthlyPayment = '월 상환액은 0원보다 커야 합니다.';
  }
  if (!Number.isInteger(loan.paymentDay) || loan.paymentDay < 1 || loan.paymentDay > 31) errors.paymentDay = '상환일은 1~31 사이로 입력하세요.';
  for (const [field, label] of [
    ['startDate', '시작일'],
    ['maturityDate', '만기일'],
    ['balanceAsOf', '잔액 기준일'],
  ] as const) {
    if (!isValidIsoDate(loan[field])) errors[field] = `${josa(label, '을/를')} 올바른 날짜로 입력하세요.`;
  }
  if (!errors.startDate && !errors.maturityDate && loan.maturityDate <= loan.startDate) {
    errors.maturityDate = '만기일은 시작일보다 뒤여야 합니다.';
  }
  if (!errors.startDate && !errors.balanceAsOf && loan.balanceAsOf < loan.startDate) {
    errors.balanceAsOf = '잔액 기준일은 시작일 이후여야 합니다.';
  }
  if (!Number.isFinite(loan.prepaymentFeePct) || loan.prepaymentFeePct < 0 || loan.prepaymentFeePct > 10) {
    errors.prepaymentFeePct = '중도상환수수료율은 0~10% 사이로 입력하세요.';
  }
  if (loan.feeWaiverDate !== null && !isValidIsoDate(loan.feeWaiverDate)) errors.feeWaiverDate = '면제 시점을 올바른 날짜로 입력하세요.';
  if (loan.linkedCashId !== null && !cashIds.includes(loan.linkedCashId)) errors.linkedCashId = '연결할 현금 항목을 다시 선택하세요.';
  return errors;
}

export function upsertById<T extends { id: string }>(list: readonly T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id);
  if (index === -1) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

export function removeById<T extends { id: string }>(list: readonly T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}
