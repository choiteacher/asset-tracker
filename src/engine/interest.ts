// 이자·세금 계산 엔진. UI와 분리된 순수 함수이며 모든 함수는 기준 시각(atMs)을 인자로 받는다.
// 실시간 화면은 값을 누적하지 않고 매번 Date.now()로 "그 시각의 값"을 처음부터 다시 계산한다.
//
// 계산 방식(단리, 1년 365일 일할을 밀리초 단위로 환산)
//  - 정기예금: 원금 × 연이율 × (가입일~기준 시각) / 365일. 만기 이후 증가 중지.
//  - 정기적금: 회차별 납입액 × 연이율 × (그 회차 납입일~기준 시각) / 365일의 합. 아직 오지 않은 회차는 제외. 만기 이후 증가 중지.
//    기준일까지 낸 회차(paidCount)는 일정대로 낸 것으로 보고, 기준일 이후 회차는 납입일이 지나면 낸 것으로 본다.
//  - 청약저축: 기준일의 납입 총액에 기준일부터 이자를 붙이고, 이후 매월(가입일의 일자) 월납입액을 더한다.
//    가입일~기준일 사이 이미 붙은 이자는 알 수 없어 반영하지 않는다(보수적 추정).
//  - 주식·펀드·현금: 입력 금액 그대로.
//  - 세금: 세전 이자 × 과세유형 세율(설정의 세율 프리셋).

import {
  hasMaturity,
  isInterestBearing,
  monthsBetween,
  TAX_TYPES,
  type Asset,
  type SavingsAsset,
  type TaxType,
} from '../data/assets';
import type { TaxRateTable } from '../data/taxRates';
import { dateMs, dayOfMonth, isoFromMs, monthDate, monthlyDatesBetween, YEAR_MS } from './time';

/** 이자가 붙는 원금 조각. addedMs 이전에는 원금에 포함되지 않는다(-Infinity = 이미 보유). */
interface Piece {
  amount: number;
  addedMs: number;
  interestFromMs: number;
}

/** 적금의 전체 납입 예정일(1회차 = 가입일, 이후 매월 납입일). */
export function savingsSchedule(asset: SavingsAsset): string[] {
  const count = Math.max(1, monthsBetween(asset.startDate, asset.maturityDate));
  const dates = [asset.startDate];
  for (let i = 1; i < count; i++) dates.push(monthDate(asset.startDate, i, asset.paymentDay));
  return dates;
}

function piecesOf(asset: Asset, atMs: number): { pieces: Piece[]; endMs: number } {
  switch (asset.type) {
    case 'deposit':
      return {
        pieces: [{ amount: asset.principal, addedMs: -Infinity, interestFromMs: dateMs(asset.startDate) }],
        endMs: dateMs(asset.maturityDate),
      };
    case 'savings': {
      const asOf = dateMs(asset.asOfDate);
      const schedule = savingsSchedule(asset);
      const paid = Math.min(asset.paidCount, schedule.length);
      const pieces: Piece[] = [];
      schedule.forEach((iso, i) => {
        const d = dateMs(iso);
        if (i < paid) pieces.push({ amount: asset.monthlyAmount, addedMs: -Infinity, interestFromMs: Math.min(d, asOf) });
        else if (d > asOf) pieces.push({ amount: asset.monthlyAmount, addedMs: d, interestFromMs: d });
      });
      return { pieces, endMs: dateMs(asset.maturityDate) };
    }
    case 'subscription': {
      const asOf = dateMs(asset.asOfDate);
      const pieces: Piece[] = [{ amount: asset.totalPaid, addedMs: -Infinity, interestFromMs: asOf }];
      if (asset.monthlyAmount > 0 && atMs > asOf) {
        for (const iso of monthlyDatesBetween(asset.asOfDate, dayOfMonth(asset.startDate), isoFromMs(atMs))) {
          const d = dateMs(iso);
          pieces.push({ amount: asset.monthlyAmount, addedMs: d, interestFromMs: d });
        }
      }
      return { pieces, endMs: Infinity };
    }
    default:
      return { pieces: [], endMs: Infinity };
  }
}

export interface AssetValuation {
  asset: Asset;
  /** 기준 시각까지 들어간 원금(현금은 연결 대출 상환 차감 후). */
  principal: number;
  interestGross: number;
  tax: number;
  interestNet: number;
  valueGross: number;
  valueNet: number;
  /** 지금 이 순간 1ms당 늘어나는 이자(세전/세후). */
  perMsGross: number;
  perMsNet: number;
  taxRatePct: number;
  matured: boolean;
  /** 기준 시각에 유동자산으로 보는지(유동 설정, 동결 해제일 경과, 만기 도래). */
  liquid: boolean;
}

export function taxRateFor(asset: Asset, taxRates: TaxRateTable): number {
  return isInterestBearing(asset) ? taxRates[asset.taxType].ratePct : 0;
}

export function isMatured(asset: Asset, atMs: number): boolean {
  return hasMaturity(asset) && atMs >= dateMs(asset.maturityDate);
}

/** 동결자산이라도 동결 해제 예정일이나 만기일이 지나면 유동으로 본다. */
export function isLiquidAt(asset: Asset, atMs: number): boolean {
  if (asset.liquidity === 'liquid') return true;
  if (asset.unfreezeDate && atMs >= dateMs(asset.unfreezeDate)) return true;
  return isMatured(asset, atMs);
}

function baseAmount(asset: Asset): number {
  switch (asset.type) {
    case 'stock':
    case 'fund':
      return asset.valuation;
    case 'cash':
      return asset.amount;
    default:
      return 0;
  }
}

/**
 * 자산 하나의 기준 시각 평가.
 * cashDeduction: 현금 항목에서 빼야 할 금액(4단계: 연결된 대출의 월 상환액 누계).
 */
export function valueAsset(asset: Asset, taxRates: TaxRateTable, atMs: number, cashDeduction = 0): AssetValuation {
  const taxRatePct = taxRateFor(asset, taxRates);
  const taxRatio = taxRatePct / 100;
  let principal = baseAmount(asset) - (asset.type === 'cash' ? cashDeduction : 0);
  let interestGross = 0;
  let perMsGross = 0;

  if (isInterestBearing(asset)) {
    const rate = asset.annualRatePct / 100;
    const { pieces, endMs } = piecesOf(asset, atMs);
    const interestEnd = Math.min(atMs, endMs);
    for (const piece of pieces) {
      if (piece.addedMs > atMs) continue;
      principal += piece.amount;
      interestGross += (piece.amount * rate * Math.max(0, interestEnd - piece.interestFromMs)) / YEAR_MS;
      if (atMs < endMs && piece.interestFromMs <= atMs) perMsGross += (piece.amount * rate) / YEAR_MS;
    }
  }

  const tax = interestGross * taxRatio;
  return {
    asset,
    principal,
    interestGross,
    tax,
    interestNet: interestGross - tax,
    valueGross: principal + interestGross,
    valueNet: principal + interestGross - tax,
    perMsGross,
    perMsNet: perMsGross * (1 - taxRatio),
    taxRatePct,
    matured: isMatured(asset, atMs),
    liquid: isLiquidAt(asset, atMs),
  };
}

/** 만기 시 예상 수령액(세후). 만기가 없는 상품은 null. 만기까지 남은 회차는 일정대로 납입한다고 가정. */
export function maturityPayout(asset: Asset, taxRates: TaxRateTable): AssetValuation | null {
  if (!hasMaturity(asset)) return null;
  return valueAsset(asset, taxRates, dateMs(asset.maturityDate));
}

export interface Amounts {
  gross: number;
  net: number;
}

export interface Portfolio {
  items: AssetValuation[];
  liquid: Amounts;
  frozen: Amounts;
  total: Amounts;
  interest: { gross: number; tax: number; net: number };
  byTax: Record<TaxType, { interest: number; tax: number }>;
  perMs: Amounts;
}

export function valuePortfolio(
  assets: readonly Asset[],
  taxRates: TaxRateTable,
  atMs: number,
  cashDeductions: Readonly<Record<string, number>> = {},
): Portfolio {
  const items = assets.map((a) => valueAsset(a, taxRates, atMs, cashDeductions[a.id] ?? 0));
  const zero = (): Amounts => ({ gross: 0, net: 0 });
  const liquid = zero();
  const frozen = zero();
  const perMs = zero();
  const interest = { gross: 0, tax: 0, net: 0 };
  const byTax = Object.fromEntries(TAX_TYPES.map((t) => [t, { interest: 0, tax: 0 }])) as Portfolio['byTax'];

  for (const item of items) {
    const bucket = item.liquid ? liquid : frozen;
    bucket.gross += item.valueGross;
    bucket.net += item.valueNet;
    perMs.gross += item.perMsGross;
    perMs.net += item.perMsNet;
    interest.gross += item.interestGross;
    interest.tax += item.tax;
    interest.net += item.interestNet;
    if (isInterestBearing(item.asset)) {
      byTax[item.asset.taxType].interest += item.interestGross;
      byTax[item.asset.taxType].tax += item.tax;
    }
  }
  return {
    items,
    liquid,
    frozen,
    total: { gross: liquid.gross + frozen.gross, net: liquid.net + frozen.net },
    interest,
    byTax,
    perMs,
  };
}
