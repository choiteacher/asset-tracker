import { useDisplayPrefs } from '../session/DisplayPrefs';
import { formatMoney } from '../utils/format';

/** 금액 표시. 금액 가리기가 켜져 있으면 ••••로 보이고, 클릭하면 다시 보인다. */
export function Money({
  value,
  decimals = 0,
  unit = '원',
  signed = false,
  className = '',
}: {
  value: number;
  decimals?: 0 | 1 | 2;
  unit?: string;
  signed?: boolean;
  className?: string;
}) {
  const { masked, setMasked } = useDisplayPrefs();
  if (masked) {
    return (
      <button
        type="button"
        className={`app-masked btn-reset ${className}`}
        onClick={() => setMasked(false)}
        title="클릭하면 금액을 표시합니다"
        aria-label="가려진 금액. 클릭하면 표시"
      >
        ••••{unit}
      </button>
    );
  }
  const sign = signed && value > 0 ? '+' : '';
  return (
    <span className={`app-num ${className}`}>
      {sign}
      {formatMoney(value, decimals)}
      {unit}
    </span>
  );
}
