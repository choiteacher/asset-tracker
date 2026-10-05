import { TAX_TYPES, type TaxType } from './assets';

// 과세유형별 이자소득세율 프리셋. 법령·상품에 따라 바뀌므로 코드에 고정하지 않고 설정 화면에서 수정한다.

export interface TaxRatePreset {
  /** 세율(%). 예: 15.4 */
  ratePct: number;
  /** 근거/한도 등 메모. */
  note: string;
  /** 사용자가 가입 상품 안내문 기준으로 확인했는지. false면 "확인 필요" 배지를 표시한다. */
  confirmed: boolean;
}

export type TaxRateTable = Record<TaxType, TaxRatePreset>;

/**
 * 초기값.
 * - 일반 15.4%(소득세 14% + 지방소득세 1.4%), 비과세 0%.
 * - 세금우대·2금융권 세금우대는 예시값이며 확인 필요(상품·가입 시기·한도에 따라 다름).
 */
export function createDefaultTaxRates(): TaxRateTable {
  return {
    general: { ratePct: 15.4, note: '소득세 14% + 지방소득세 1.4%', confirmed: true },
    preferential: { ratePct: 9.5, note: '예시값: 소득세 9% + 농어촌특별세 0.5%', confirmed: false },
    taxFree: { ratePct: 0, note: '비과세 종합저축 등', confirmed: true },
    mutualPreferential: {
      ratePct: 1.4,
      note: '예시값: 상호금융 예탁금 이자소득세 면제 + 농어촌특별세 1.4%',
      confirmed: false,
    },
  };
}

export const MAX_TAX_RATE_PCT = 100;

export function isValidTaxRate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_TAX_RATE_PCT;
}

/** 저장된 값을 읽을 때 빠지거나 깨진 항목은 기본값으로 채운다. */
export function normalizeTaxRates(raw: unknown): TaxRateTable {
  const defaults = createDefaultTaxRates();
  if (typeof raw !== 'object' || raw === null) return defaults;
  const source = raw as Record<string, unknown>;
  const result = { ...defaults };
  for (const type of TAX_TYPES) {
    const item = source[type];
    if (typeof item !== 'object' || item === null) continue;
    const { ratePct, note, confirmed } = item as Record<string, unknown>;
    result[type] = {
      ratePct: typeof ratePct === 'number' && isValidTaxRate(ratePct) ? ratePct : defaults[type].ratePct,
      note: typeof note === 'string' ? note : defaults[type].note,
      confirmed: typeof confirmed === 'boolean' ? confirmed : defaults[type].confirmed,
    };
  }
  return result;
}
