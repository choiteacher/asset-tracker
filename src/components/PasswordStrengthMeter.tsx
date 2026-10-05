import { assessPassword, MIN_PASSWORD_LENGTH } from '../auth/passwordStrength';

const BAR_CLASS = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success'];

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { level, label, hints, meetsMinimum } = assessPassword(password);
  const percent = password ? Math.max(10, (level / 4) * 100) : 0;
  return (
    <div className="mb-3" aria-live="polite">
      <div className="progress app-strength" role="progressbar" aria-label="비밀번호 강도" aria-valuenow={level} aria-valuemin={0} aria-valuemax={4}>
        <div className={`progress-bar ${BAR_CLASS[level]}`} style={{ width: `${percent}%` }} />
      </div>
      <small className="text-muted d-block mt-1">
        {password ? (
          <>
            강도: <strong>{label}</strong>
            {!meetsMinimum && ` · 최소 ${MIN_PASSWORD_LENGTH}자 필요`}
          </>
        ) : (
          `최소 ${MIN_PASSWORD_LENGTH}자 이상. 영문 대·소문자, 숫자, 기호를 섞으면 더 안전합니다.`
        )}
      </small>
      {password && hints.length > 0 && (
        <ul className="small text-muted mb-0 ps-3 mt-1">
          {hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
