const dateTimeFormat = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(iso: string | null): string {
  if (!iso) return '없음';
  const time = Date.parse(iso);
  return Number.isNaN(time) ? '알 수 없음' : dateTimeFormat.format(time);
}

const wonFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });

/** 1234567 → "1,234,567원" */
export function formatWon(value: number): string {
  return `${wonFormat.format(Math.round(value))}원`;
}

/** 'YYYY-MM-DD' → "2026.01.15" */
export function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return iso.replaceAll('-', '.');
}

export function formatRate(pct: number): string {
  return `${Number.isFinite(pct) ? pct.toLocaleString('ko-KR', { maximumFractionDigits: 3 }) : '-'}%`;
}

const moneyFormats = [0, 1, 2].map(
  (d) => new Intl.NumberFormat('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }),
);

/** 천 단위 구분 숫자(소수 자릿수 고정). -0.0 표시는 0으로 바꾼다. */
export function formatMoney(value: number, decimals: 0 | 1 | 2 = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  const rounded = Math.abs(safe) < 0.5 * 10 ** -decimals ? 0 : safe;
  return moneyFormats[decimals]!.format(rounded);
}
