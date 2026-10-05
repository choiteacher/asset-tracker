// Recharts 공통 설정. 색은 CSS 변수(_app.scss의 --series-*)로 지정해 라이트/다크에서 각각 검증된 값이 쓰인다.
// 순자산=1(파랑), 부채=2(주황), 유동=3(청록), 동결=4(노랑) — 항목별 색은 고정(순서 바꾸지 않음).

import type { ReactNode } from 'react';
import { useDisplayPrefs } from '../session/DisplayPrefs';
import { formatMoney } from '../utils/format';

export const SERIES = {
  net: 'var(--series-1)',
  debt: 'var(--series-2)',
  liquid: 'var(--series-3)',
  frozen: 'var(--series-4)',
} as const;

export const AXIS_PROPS = {
  stroke: 'var(--chart-axis)',
  tick: { fill: 'var(--chart-text)', fontSize: 12 },
  tickLine: false,
} as const;

export const GRID_PROPS = { stroke: 'var(--chart-grid)', strokeDasharray: '0', vertical: false } as const;

/** 축 눈금: 만원/억 단위로 짧게. */
export function shortWon(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${(value / 1e8).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억`;
  if (abs >= 1e4) return `${Math.round(value / 1e4).toLocaleString('ko-KR')}만`;
  return value.toLocaleString('ko-KR');
}

interface TooltipEntry {
  name?: string | number;
  value?: number | string | readonly (number | string)[];
  color?: string;
  dataKey?: string | number | ((obj: unknown) => unknown);
}

/** 금액 가리기를 따르는 툴팁. */
export function MoneyTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: ReactNode;
  labelFormatter?: (label: ReactNode) => ReactNode;
}) {
  const { masked } = useDisplayPrefs();
  if (!active || !payload?.length) return null;
  return (
    <div className="app-chart-tooltip">
      <div className="fw-semibold mb-1">{labelFormatter ? labelFormatter(label) : label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="d-flex align-items-center gap-2">
          <span className="app-chart-swatch" style={{ background: p.color }} aria-hidden="true" />
          <span className="text-muted">{p.name}</span>
          <span className="ms-auto app-num">{masked ? '••••원' : `${formatMoney(Number(p.value))}원`}</span>
        </div>
      ))}
    </div>
  );
}

/** Y축 눈금 포맷. 금액 가리기가 켜져 있으면 눈금 숫자도 숨긴다. */
export function useMoneyTick(): (value: number) => string {
  const { masked } = useDisplayPrefs();
  return masked ? () => '•••' : shortWon;
}
