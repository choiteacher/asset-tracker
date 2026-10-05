import { describe, expect, it } from 'vitest';
import {
  countByType,
  isValid,
  isValidIsoDate,
  monthsBetween,
  principalAmount,
  removeAsset,
  sumPrincipalByLiquidity,
  upsertAsset,
  validateAsset,
  type Asset,
} from './assets';
import { assetToForm, emptyAssetForm, formatAmountInput, formToAsset, parseNumber } from './assetForm';
import {
  sampleAssets,
  sampleCash,
  sampleDeposit,
  sampleSavings,
  sampleStock,
  sampleSubscription,
} from './fixtures';
import { createDefaultTaxRates, normalizeTaxRates } from './taxRates';

const NOW = new Date('2026-01-15T09:00:00');

describe('날짜 도우미', () => {
  it('실제 존재하는 날짜만 통과한다', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-1-5')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });

  it('가입~만기 개월 수', () => {
    expect(monthsBetween('2026-01-10', '2027-01-10')).toBe(12);
    expect(monthsBetween('2026-01-10', '2027-01-09')).toBe(11);
    expect(monthsBetween('2026-01-31', '2026-03-01')).toBe(1);
  });
});

describe('validateAsset', () => {
  it('가상 샘플 자산은 모두 통과한다', () => {
    for (const asset of sampleAssets) expect(validateAsset(asset), asset.id).toEqual({});
  });

  it('음수 금액을 거부한다', () => {
    expect(validateAsset({ ...sampleDeposit, principal: -1 }).principal).toMatch(/0원 이상/);
    expect(validateAsset({ ...sampleCash, amount: -500 }).amount).toBeDefined();
    expect(validateAsset({ ...sampleStock, valuation: Number.NaN }).valuation).toMatch(/숫자/);
  });

  it('만기일이 가입일보다 앞서거나 같으면 거부한다', () => {
    expect(validateAsset({ ...sampleDeposit, maturityDate: '2025-12-31' }).maturityDate).toMatch(/뒤여야/);
    expect(validateAsset({ ...sampleDeposit, maturityDate: sampleDeposit.startDate }).maturityDate).toBeDefined();
  });

  it('연이율은 0~100% 사이여야 한다', () => {
    expect(validateAsset({ ...sampleDeposit, annualRatePct: -0.1 }).annualRatePct).toBeDefined();
    expect(validateAsset({ ...sampleDeposit, annualRatePct: 101 }).annualRatePct).toBeDefined();
    expect(validateAsset({ ...sampleDeposit, annualRatePct: 0 })).toEqual({});
  });

  it('상품명은 필수, 잘못된 날짜는 거부한다', () => {
    expect(validateAsset({ ...sampleCash, name: '  ' }).name).toBeDefined();
    expect(validateAsset({ ...sampleCash, asOfDate: '2026-02-30' }).asOfDate).toBeDefined();
    expect(validateAsset({ ...sampleCash, unfreezeDate: 'abc' }).unfreezeDate).toBeDefined();
  });

  it('적금: 납입일 1~31, 납입 회차는 가입 기간 이내의 정수', () => {
    expect(validateAsset({ ...sampleSavings, paymentDay: 0 }).paymentDay).toBeDefined();
    expect(validateAsset({ ...sampleSavings, paymentDay: 32 }).paymentDay).toBeDefined();
    expect(validateAsset({ ...sampleSavings, paidCount: 1.5 }).paidCount).toBeDefined();
    expect(validateAsset({ ...sampleSavings, paidCount: 12 })).toEqual({});
    expect(validateAsset({ ...sampleSavings, paidCount: 13 }).paidCount).toMatch(/12개월/);
  });

  it('2금융권 세금우대는 금융기관명이 필요하다', () => {
    expect(validateAsset({ ...sampleSavings, institution: '' }).institution).toMatch(/금융기관명/);
    expect(validateAsset({ ...sampleSavings, taxType: 'general', institution: '' })).toEqual({});
  });

  it('동결 해제 예정일은 가입일 이후여야 한다', () => {
    expect(validateAsset({ ...sampleSubscription, unfreezeDate: '2023-12-31' }).unfreezeDate).toBeDefined();
    expect(validateAsset({ ...sampleSubscription, unfreezeDate: '2027-04-01' })).toEqual({});
  });
});

describe('원금 기준 합계', () => {
  it('유형별 원금 기준 금액', () => {
    expect(principalAmount(sampleDeposit)).toBe(10_000_000);
    expect(principalAmount(sampleSavings)).toBe(1_500_000); // 50만 원 × 3회
    expect(principalAmount(sampleSubscription)).toBe(2_400_000);
    expect(principalAmount(sampleStock)).toBe(3_210_000);
    expect(principalAmount(sampleCash)).toBe(1_234_567);
  });

  it('유동/동결로 나눠 합산한다', () => {
    expect(sumPrincipalByLiquidity(sampleAssets)).toEqual({
      liquid: 3_210_000 + 1_234_567,
      frozen: 10_000_000 + 1_500_000 + 2_400_000,
      total: 18_344_567,
    });
    // 사용자가 유동으로 바꾸면 그쪽으로 집계된다.
    const changed: Asset[] = [{ ...sampleDeposit, liquidity: 'liquid' }];
    expect(sumPrincipalByLiquidity(changed)).toEqual({ liquid: 10_000_000, frozen: 0, total: 10_000_000 });
    expect(sumPrincipalByLiquidity([])).toEqual({ liquid: 0, frozen: 0, total: 0 });
  });

  it('유형별 개수', () => {
    expect(countByType(sampleAssets)).toEqual({ deposit: 1, savings: 1, subscription: 1, stock: 1, fund: 0, cash: 1 });
  });
});

describe('목록 변경', () => {
  it('upsert는 같은 id를 교체하고 새 id는 추가한다', () => {
    const list = [sampleDeposit, sampleCash];
    const updated = upsertAsset(list, { ...sampleCash, amount: 1 });
    expect(updated).toHaveLength(2);
    expect((updated[1] as typeof sampleCash).amount).toBe(1);
    expect(upsertAsset(list, sampleStock)).toHaveLength(3);
    expect(list).toHaveLength(2); // 원본 불변
  });

  it('remove는 해당 id만 지운다', () => {
    expect(removeAsset(sampleAssets, 'stk-1').map((a) => a.id)).toEqual(['dep-1', 'sav-1', 'sub-1', 'csh-1']);
  });
});

describe('입력 폼 변환', () => {
  it('금액 문자열 파싱', () => {
    expect(parseNumber('1,234,567')).toBe(1234567);
    expect(parseNumber(' 3.5 ')).toBe(3.5);
    expect(parseNumber('-100')).toBe(-100);
    expect(parseNumber('')).toBeNaN();
    expect(parseNumber('12a')).toBeNaN();
  });

  it('입력 중 천 단위 구분', () => {
    expect(formatAmountInput('1234567')).toBe('1,234,567');
    expect(formatAmountInput('001,000')).toBe('1,000');
    expect(formatAmountInput('')).toBe('');
    expect(formatAmountInput('-50')).toBe('-50');
  });

  it('자산 → 폼 → 자산 왕복 시 값이 보존된다', () => {
    for (const asset of sampleAssets) {
      const back = formToAsset(assetToForm(asset, NOW), asset, new Date(asset.updatedAt));
      expect(back, asset.id).toEqual(asset);
    }
  });

  it('새 폼은 유형별 유동/동결 기본값을 제안한다', () => {
    expect(emptyAssetForm('subscription', NOW).liquidity).toBe('frozen');
    expect(emptyAssetForm('cash', NOW).liquidity).toBe('liquid');
    expect(emptyAssetForm('cash', NOW).asOfDate).toBe('2026-01-15');
  });

  it('빈 금액은 NaN이 되어 검증에서 걸린다', () => {
    const form = { ...emptyAssetForm('cash', NOW), name: '가상' };
    const asset = formToAsset(form, { id: 'x', createdAt: NOW.toISOString() }, NOW);
    expect(isValid(validateAsset(asset))).toBe(false);
  });
});

describe('세율 프리셋', () => {
  it('초기값: 일반 15.4%, 비과세 0%, 나머지는 확인 필요 표시', () => {
    const rates = createDefaultTaxRates();
    expect(rates.general.ratePct).toBe(15.4);
    expect(rates.taxFree.ratePct).toBe(0);
    expect(rates.preferential.confirmed).toBe(false);
    expect(rates.mutualPreferential.confirmed).toBe(false);
  });

  it('깨진 값은 기본값으로 채운다', () => {
    const normalized = normalizeTaxRates({ general: { ratePct: -3, note: 1 }, preferential: { ratePct: 5 } });
    expect(normalized.general.ratePct).toBe(15.4);
    expect(normalized.preferential.ratePct).toBe(5);
    expect(normalized.preferential.confirmed).toBe(false);
  });
});

describe('조사 선택', () => {
  it('받침 유무에 따라 을/를, 이/가를 고른다', async () => {
    const { josa } = await import('../utils/josa');
    expect(josa('월납입액', '을/를')).toBe('월납입액을');
    expect(josa('예치원금', '은/는')).toBe('예치원금은');
    expect(josa('정기예금', '이/가')).toBe('정기예금이');
    expect(josa('펀드', '이/가')).toBe('펀드가');
    expect(josa('ETF', '을/를')).toBe('ETF을(를)');
  });
});
