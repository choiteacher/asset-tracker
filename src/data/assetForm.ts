// 입력 폼(문자열 값) <-> 자산 모델 변환. 화면과 분리해 테스트한다.

import {
  DEFAULT_LIQUIDITY,
  toIsoDate,
  type Asset,
  type AssetType,
  type InterestPayout,
  type Liquidity,
  type TaxType,
} from './assets';

/** 폼은 입력 중인 문자열을 그대로 들고 있다. 모든 유형의 필드를 함께 갖고, 유형에 맞는 것만 쓴다. */
export interface AssetFormValues {
  type: AssetType;
  name: string;
  institution: string;
  memo: string;
  liquidity: Liquidity;
  unfreezeDate: string;
  /** 분양 시점 활용 가능 여부. */
  housingUsable: boolean;
  asOfDate: string;
  annualRatePct: string;
  startDate: string;
  maturityDate: string;
  taxType: TaxType;
  taxNote: string;
  principal: string;
  interestPayout: InterestPayout;
  monthlyAmount: string;
  paymentDay: string;
  paidCount: string;
  totalPaid: string;
  valuation: string;
  amount: string;
}

/** "1,234,567" / " 1234567 " → 1234567. 비어 있거나 숫자가 아니면 NaN(검증에서 걸러진다). */
export function parseNumber(text: string): number {
  const cleaned = text.replace(/[,\s원%]/g, '');
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

/** 입력 중인 금액에 천 단위 구분 기호를 넣는다. 숫자 외 문자는 지운다(음수 부호 유지). */
export function formatAmountInput(text: string): string {
  const negative = text.trim().startsWith('-');
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return negative ? '-' : '';
  return (negative ? '-' : '') + Number(digits).toLocaleString('ko-KR');
}

function amountToText(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('ko-KR') : '';
}

export function emptyAssetForm(type: AssetType, today: Date): AssetFormValues {
  const iso = toIsoDate(today);
  return {
    type,
    name: '',
    institution: '',
    memo: '',
    liquidity: DEFAULT_LIQUIDITY[type],
    unfreezeDate: '',
    housingUsable: true,
    asOfDate: iso,
    annualRatePct: '',
    startDate: iso,
    maturityDate: '',
    taxType: 'general',
    taxNote: '',
    principal: '',
    interestPayout: 'atMaturity',
    monthlyAmount: '',
    paymentDay: String(today.getDate()),
    paidCount: '',
    totalPaid: '',
    valuation: '',
    amount: '',
  };
}

export function assetToForm(asset: Asset, today: Date): AssetFormValues {
  const form = emptyAssetForm(asset.type, today);
  Object.assign(form, {
    name: asset.name,
    institution: asset.institution,
    memo: asset.memo,
    liquidity: asset.liquidity,
    unfreezeDate: asset.unfreezeDate ?? '',
    asOfDate: asset.asOfDate,
    housingUsable: asset.housingUsable !== false,
  });
  switch (asset.type) {
    case 'deposit':
      Object.assign(form, {
        principal: amountToText(asset.principal),
        maturityDate: asset.maturityDate,
        interestPayout: asset.interestPayout,
      });
      break;
    case 'savings':
      Object.assign(form, {
        monthlyAmount: amountToText(asset.monthlyAmount),
        maturityDate: asset.maturityDate,
        paymentDay: String(asset.paymentDay),
        paidCount: String(asset.paidCount),
      });
      break;
    case 'subscription':
      Object.assign(form, {
        totalPaid: amountToText(asset.totalPaid),
        monthlyAmount: amountToText(asset.monthlyAmount),
      });
      break;
    case 'stock':
    case 'fund':
      form.valuation = amountToText(asset.valuation);
      break;
    case 'cash':
      form.amount = amountToText(asset.amount);
      break;
  }
  if (asset.type === 'deposit' || asset.type === 'savings' || asset.type === 'subscription') {
    Object.assign(form, {
      annualRatePct: String(asset.annualRatePct),
      startDate: asset.startDate,
      taxType: asset.taxType,
      taxNote: asset.taxNote,
    });
  }
  return form;
}

/**
 * 폼 값을 자산 모델로 만든다. 검증은 하지 않는다(validateAsset으로 따로 한다).
 * existing이 있으면 id·생성 시각을 유지한다.
 */
export function formToAsset(form: AssetFormValues, ids: { id: string; createdAt: string }, now: Date): Asset {
  const base = {
    id: ids.id,
    name: form.name.trim(),
    institution: form.institution.trim(),
    memo: form.memo.trim(),
    liquidity: form.liquidity,
    unfreezeDate: form.unfreezeDate.trim() || null,
    asOfDate: form.asOfDate,
    createdAt: ids.createdAt,
    updatedAt: now.toISOString(),
    // 기본값(사용 가능)이면 저장하지 않는다.
    ...(form.housingUsable ? {} : { housingUsable: false as const }),
  };
  const interest = {
    annualRatePct: parseNumber(form.annualRatePct),
    startDate: form.startDate,
    taxType: form.taxType,
    taxNote: form.taxType === 'mutualPreferential' ? form.taxNote.trim() : '',
  };
  switch (form.type) {
    case 'deposit':
      return {
        ...base,
        ...interest,
        type: 'deposit',
        principal: parseNumber(form.principal),
        maturityDate: form.maturityDate,
        interestPayout: form.interestPayout,
      };
    case 'savings':
      return {
        ...base,
        ...interest,
        type: 'savings',
        monthlyAmount: parseNumber(form.monthlyAmount),
        maturityDate: form.maturityDate,
        paymentDay: parseNumber(form.paymentDay),
        paidCount: parseNumber(form.paidCount),
      };
    case 'subscription':
      return {
        ...base,
        ...interest,
        type: 'subscription',
        totalPaid: parseNumber(form.totalPaid),
        monthlyAmount: parseNumber(form.monthlyAmount),
      };
    case 'stock':
    case 'fund':
      return { ...base, type: form.type, valuation: parseNumber(form.valuation) };
    case 'cash':
      return { ...base, type: 'cash', amount: parseNumber(form.amount) };
  }
}
