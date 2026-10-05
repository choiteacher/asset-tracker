// Bootstrap(템플릿) 스타일 입력 필드. 오류 문구가 있으면 is-invalid로 표시한다.

import { useId, type ReactNode } from 'react';
import { formatAmountInput } from '../data/assetForm';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: (id: string, invalid: boolean) => ReactNode;
}

function FieldShell({ label, error, hint, className = 'col-md-6', children }: FieldShellProps) {
  const id = useId();
  return (
    <div className={`${className} mb-3`}>
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      {children(id, Boolean(error))}
      {error && <div className="invalid-feedback d-block">{error}</div>}
      {hint && !error && <div className="form-text">{hint}</div>}
    </div>
  );
}

interface BaseProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  className?: string;
}

export function TextField({ maxLength = 100, placeholder, ...props }: BaseProps & { maxLength?: number; placeholder?: string }) {
  return (
    <FieldShell {...props}>
      {(id, invalid) => (
        <input
          id={id}
          className={`form-control${invalid ? ' is-invalid' : ''}`}
          value={props.value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </FieldShell>
  );
}

/** 금액: 입력하는 동안 천 단위 구분 기호를 넣고, 오른쪽에 "원"을 붙인다. */
export function MoneyField(props: BaseProps) {
  return (
    <FieldShell {...props}>
      {(id, invalid) => (
        <div className={`input-group${invalid ? ' has-validation' : ''}`}>
          <input
            id={id}
            className={`form-control text-end app-num${invalid ? ' is-invalid' : ''}`}
            inputMode="numeric"
            autoComplete="off"
            value={props.value}
            onChange={(e) => props.onChange(formatAmountInput(e.target.value))}
          />
          <span className="input-group-text">원</span>
        </div>
      )}
    </FieldShell>
  );
}

export function NumberField({ suffix, decimal = false, ...props }: BaseProps & { suffix: string; decimal?: boolean }) {
  return (
    <FieldShell {...props}>
      {(id, invalid) => (
        <div className="input-group">
          <input
            id={id}
            className={`form-control text-end app-num${invalid ? ' is-invalid' : ''}`}
            inputMode={decimal ? 'decimal' : 'numeric'}
            autoComplete="off"
            value={props.value}
            onChange={(e) => props.onChange(e.target.value.replace(decimal ? /[^\d.]/g : /\D/g, ''))}
          />
          <span className="input-group-text">{suffix}</span>
        </div>
      )}
    </FieldShell>
  );
}

export function DateField(props: BaseProps) {
  return (
    <FieldShell {...props}>
      {(id, invalid) => (
        <input
          id={id}
          type="date"
          className={`form-control${invalid ? ' is-invalid' : ''}`}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </FieldShell>
  );
}

export function SelectField<T extends string>({
  options,
  disabled,
  ...props
}: Omit<BaseProps, 'value' | 'onChange'> & {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <FieldShell {...props}>
      {(id, invalid) => (
        <select
          id={id}
          className={`form-select${invalid ? ' is-invalid' : ''}`}
          value={props.value}
          disabled={disabled}
          onChange={(e) => props.onChange(e.target.value as T)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}
