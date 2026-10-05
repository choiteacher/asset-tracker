// 자산 데이터 모델과 순수 함수(검증, 원금 기준 합계, 목록 변경). UI와 무관하다.

import { josa } from '../utils/josa';

export type AssetType = 'deposit' | 'savings' | 'subscription' | 'stock' | 'fund' | 'cash';
export type TaxType = 'general' | 'preferential' | 'taxFree' | 'mutualPreferential';
export type Liquidity = 'liquid' | 'frozen';
export type InterestPayout = 'atMaturity' | 'monthly';

/** 날짜는 모두 현지 날짜 'YYYY-MM-DD' 문자열로 저장한다. */
export type IsoDate = string;

interface AssetBase {
  id: string;
  type: AssetType;
  name: string;
  institution: string;
  memo: string;
  liquidity: Liquidity;
  /** 동결 해제 예정일(선택). */
  unfreezeDate: IsoDate | null;
  /** 평가/기준일. */
  asOfDate: IsoDate;
  /** 분양 시점에 이 자산을 분양 대금으로 쓸 수 있는지(사용자 판단). 없으면 사용 가능으로 본다. */
  housingUsable?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 이자가 붙는 상품 공통. 2금융권 세금우대일 때 세율/한도 메모를 따로 둔다. */
interface InterestBearing {
  annualRatePct: number;
  startDate: IsoDate;
  taxType: TaxType;
  taxNote: string;
}

export interface DepositAsset extends AssetBase, InterestBearing {
  type: 'deposit';
  principal: number;
  maturityDate: IsoDate;
  interestPayout: InterestPayout;
}

export interface SavingsAsset extends AssetBase, InterestBearing {
  type: 'savings';
  monthlyAmount: number;
  maturityDate: IsoDate;
  /** 매월 납입일(1~31). */
  paymentDay: number;
  /** 지금까지 납입한 회차 수. */
  paidCount: number;
}

export interface SubscriptionAsset extends AssetBase, InterestBearing {
  type: 'subscription';
  totalPaid: number;
  monthlyAmount: number;
}

export interface ValuedAsset extends AssetBase {
  type: 'stock' | 'fund';
  /** 평가금액(직접 입력). 평가 기준일은 asOfDate. */
  valuation: number;
}

export interface CashAsset extends AssetBase {
  type: 'cash';
  amount: number;
}

export type Asset = DepositAsset | SavingsAsset | SubscriptionAsset | ValuedAsset | CashAsset;

export const ASSET_TYPES: readonly AssetType[] = ['deposit', 'savings', 'subscription', 'stock', 'fund', 'cash'];
export const TAX_TYPES: readonly TaxType[] = ['general', 'preferential', 'taxFree', 'mutualPreferential'];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  deposit: '정기예금',
  savings: '정기적금',
  subscription: '청약저축',
  stock: '주식',
  fund: '펀드',
  cash: '현금/입출금',
};

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  general: '일반',
  preferential: '세금우대',
  taxFree: '비과세',
  mutualPreferential: '2금융권 세금우대(상호금융 등)',
};

export const LIQUIDITY_LABELS: Record<Liquidity, string> = { liquid: '유동', frozen: '동결' };

/** 유형별 유동/동결 기본값 제안. 사용자가 바꿀 수 있다. */
export const DEFAULT_LIQUIDITY: Record<AssetType, Liquidity> = {
  deposit: 'frozen',
  savings: 'frozen',
  subscription: 'frozen',
  stock: 'liquid',
  fund: 'liquid',
  cash: 'liquid',
};

export function isInterestBearing(asset: Asset): asset is DepositAsset | SavingsAsset | SubscriptionAsset {
  return asset.type === 'deposit' || asset.type === 'savings' || asset.type === 'subscription';
}

export function hasMaturity(asset: Asset): asset is DepositAsset | SavingsAsset {
  return asset.type === 'deposit' || asset.type === 'savings';
}

// ---------------------------------------------------------------------------
// 날짜
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 실제 존재하는 날짜의 'YYYY-MM-DD'인지(2월 30일 등 거부). */
export function isValidIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function toIsoDate(date: Date): IsoDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 가입일~만기일 사이의 납입 가능한 최대 회차(개월 수). 같은 날 가입·만기면 0. */
export function monthsBetween(start: IsoDate, end: IsoDate): number {
  const [sy, sm, sd] = start.split('-').map(Number) as [number, number, number];
  const [ey, em, ed] = end.split('-').map(Number) as [number, number, number];
  let months = (ey - sy) * 12 + (em - sm);
  if (ed < sd) months -= 1;
  return Math.max(0, months);
}

// ---------------------------------------------------------------------------
// 검증
// ---------------------------------------------------------------------------

export const MAX_AMOUNT = 1e13; // 10조 원. 입력 실수를 막기 위한 상한.
export const MAX_RATE_PCT = 100;

/** 필드 이름 → 오류 문구. 비어 있으면 통과. */
export type ValidationErrors = Partial<Record<string, string>>;

function checkAmount(errors: ValidationErrors, field: string, value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) errors[field] = `${josa(label, '을/를')} 숫자로 입력하세요.`;
  else if (value < 0) errors[field] = `${josa(label, '은/는')} 0원 이상이어야 합니다.`;
  else if (value > MAX_AMOUNT) errors[field] = `${josa(label, '이/가')} 너무 큽니다.`;
}

function checkRate(errors: ValidationErrors, value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) errors.annualRatePct = '연이율을 숫자로 입력하세요.';
  else if (value < 0) errors.annualRatePct = '연이율은 0% 이상이어야 합니다.';
  else if (value > MAX_RATE_PCT) errors.annualRatePct = `연이율은 ${MAX_RATE_PCT}% 이하여야 합니다.`;
}

function checkDate(errors: ValidationErrors, field: string, value: unknown, label: string) {
  if (!isValidIsoDate(value)) errors[field] = `${josa(label, '을/를')} 올바른 날짜로 입력하세요.`;
}

/** 저장 전 자산 하나를 검증한다. 오류가 없으면 빈 객체. */
export function validateAsset(asset: Asset): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!ASSET_TYPES.includes(asset.type)) errors.type = '자산 유형을 선택하세요.';
  if (!asset.name.trim()) errors.name = '상품명을 입력하세요.';
  else if (asset.name.length > 100) errors.name = '상품명은 100자 이하로 입력하세요.';
  if (asset.institution.length > 100) errors.institution = '금융기관명은 100자 이하로 입력하세요.';
  if (asset.memo.length > 2000) errors.memo = '메모는 2000자 이하로 입력하세요.';
  if (asset.liquidity !== 'liquid' && asset.liquidity !== 'frozen') errors.liquidity = '유동/동결을 선택하세요.';
  checkDate(errors, 'asOfDate', asset.asOfDate, '기준일');
  if (asset.unfreezeDate !== null) checkDate(errors, 'unfreezeDate', asset.unfreezeDate, '동결 해제 예정일');

  if (isInterestBearing(asset)) {
    checkRate(errors, asset.annualRatePct);
    checkDate(errors, 'startDate', asset.startDate, '가입일');
    if (!TAX_TYPES.includes(asset.taxType)) errors.taxType = '과세유형을 선택하세요.';
    if (asset.taxType === 'mutualPreferential' && !asset.institution.trim()) {
      errors.institution = '2금융권 세금우대 상품은 금융기관명을 입력하세요.';
    }
    if (asset.taxNote.length > 500) errors.taxNote = '세율/한도 메모는 500자 이하로 입력하세요.';
  }

  switch (asset.type) {
    case 'deposit':
      checkAmount(errors, 'principal', asset.principal, '예치원금');
      checkDate(errors, 'maturityDate', asset.maturityDate, '만기일');
      if (asset.interestPayout !== 'atMaturity' && asset.interestPayout !== 'monthly') {
        errors.interestPayout = '이자 지급방식을 선택하세요.';
      }
      break;
    case 'savings': {
      checkAmount(errors, 'monthlyAmount', asset.monthlyAmount, '월납입액');
      checkDate(errors, 'maturityDate', asset.maturityDate, '만기일');
      if (!Number.isInteger(asset.paymentDay) || asset.paymentDay < 1 || asset.paymentDay > 31) {
        errors.paymentDay = '납입일은 1~31 사이로 입력하세요.';
      }
      if (!Number.isInteger(asset.paidCount) || asset.paidCount < 0) {
        errors.paidCount = '납입 회차는 0 이상의 정수로 입력하세요.';
      } else if (
        isValidIsoDate(asset.startDate) &&
        isValidIsoDate(asset.maturityDate) &&
        asset.maturityDate > asset.startDate
      ) {
        // 가입일에 1회차를 내고 이후 매월 납입하므로 최대 회차 = 개월 수(+1회는 허용하지 않음).
        const maxCount = Math.max(1, monthsBetween(asset.startDate, asset.maturityDate));
        if (asset.paidCount > maxCount) errors.paidCount = `납입 회차는 가입 기간(${maxCount}개월)을 넘을 수 없습니다.`;
      }
      break;
    }
    case 'subscription':
      checkAmount(errors, 'totalPaid', asset.totalPaid, '납입 총액');
      checkAmount(errors, 'monthlyAmount', asset.monthlyAmount, '월납입액');
      break;
    case 'stock':
    case 'fund':
      checkAmount(errors, 'valuation', asset.valuation, '평가금액');
      break;
    case 'cash':
      checkAmount(errors, 'amount', asset.amount, '금액');
      break;
  }

  if (hasMaturity(asset) && isValidIsoDate(asset.startDate) && isValidIsoDate(asset.maturityDate)) {
    if (asset.maturityDate <= asset.startDate) errors.maturityDate = '만기일은 가입일보다 뒤여야 합니다.';
  }
  if (
    isInterestBearing(asset) &&
    asset.unfreezeDate !== null &&
    isValidIsoDate(asset.unfreezeDate) &&
    isValidIsoDate(asset.startDate) &&
    asset.unfreezeDate < asset.startDate
  ) {
    errors.unfreezeDate = '동결 해제 예정일은 가입일보다 뒤여야 합니다.';
  }

  return errors;
}

export function isValid(errors: ValidationErrors): boolean {
  return Object.keys(errors).length === 0;
}

// ---------------------------------------------------------------------------
// 원금 기준 금액 (2단계: 이자 미반영. 실시간 이자 계산은 3단계 엔진에서)
// ---------------------------------------------------------------------------

export function principalAmount(asset: Asset): number {
  switch (asset.type) {
    case 'deposit':
      return asset.principal;
    case 'savings':
      return asset.monthlyAmount * asset.paidCount;
    case 'subscription':
      return asset.totalPaid;
    case 'stock':
    case 'fund':
      return asset.valuation;
    case 'cash':
      return asset.amount;
  }
}

export interface PrincipalTotals {
  liquid: number;
  frozen: number;
  total: number;
}

export function sumPrincipalByLiquidity(assets: readonly Asset[]): PrincipalTotals {
  let liquid = 0;
  let frozen = 0;
  for (const asset of assets) {
    if (asset.liquidity === 'liquid') liquid += principalAmount(asset);
    else frozen += principalAmount(asset);
  }
  return { liquid, frozen, total: liquid + frozen };
}

export function countByType(assets: readonly Asset[]): Record<AssetType, number> {
  const counts = Object.fromEntries(ASSET_TYPES.map((t) => [t, 0])) as Record<AssetType, number>;
  for (const asset of assets) counts[asset.type]++;
  return counts;
}

// ---------------------------------------------------------------------------
// 목록 변경 (불변)
// ---------------------------------------------------------------------------

export function upsertAsset(assets: readonly Asset[], asset: Asset): Asset[] {
  const index = assets.findIndex((a) => a.id === asset.id);
  if (index === -1) return [...assets, asset];
  const next = [...assets];
  next[index] = asset;
  return next;
}

export function removeAsset(assets: readonly Asset[], id: string): Asset[] {
  return assets.filter((a) => a.id !== id);
}
