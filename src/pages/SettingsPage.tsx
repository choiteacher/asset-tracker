import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { assessPassword } from '../auth/passwordStrength';
import { MainCard } from '../components/MainCard';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { RestoreBackupForm } from '../components/RestoreBackupForm';
import { TaxPresetBadge } from '../components/TaxPresetBadge';
import { TAX_TYPE_LABELS, TAX_TYPES, type TaxType } from '../data/assets';
import { getBackupReminder } from '../data/backupReminder';
import { AUTO_LOCK_MAX_MINUTES, AUTO_LOCK_MIN_MINUTES } from '../data/schema';
import { createDefaultTaxRates, isValidTaxRate, type TaxRateTable } from '../data/taxRates';
import { useSession, useUnlockedData } from '../session/SessionContext';
import { parseNumber } from '../data/assetForm';
import { toUserMessage } from '../utils/errors';
import { formatDateTime } from '../utils/format';

export function SettingsPage() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#backup') document.getElementById('backup')?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);

  return (
    <div className="row">
      <div className="col-12">
        <TaxPresetSection />
      </div>
      <div className="col-xl-6">
        <ChangePasswordSection />
        <AutoLockSection />
      </div>
      <div className="col-xl-6">
        <BackupSection />
      </div>
    </div>
  );
}

type Message = { kind: 'danger' | 'success'; text: string } | null;

function MessageBox({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <div className={`alert alert-${message.kind} py-2 mt-3 mb-0`} role="status">
      {message.text}
    </div>
  );
}

function TaxPresetSection() {
  const data = useUnlockedData();
  const { updateData } = useSession();
  const toDraft = (table: TaxRateTable) =>
    Object.fromEntries(TAX_TYPES.map((t) => [t, { ...table[t], rateText: String(table[t].ratePct) }])) as Record<
      TaxType,
      TaxRateTable[TaxType] & { rateText: string }
    >;
  const [draft, setDraft] = useState(() => toDraft(data.settings.taxRates));
  const [message, setMessage] = useState<Message>(null);

  const invalid = TAX_TYPES.filter((t) => !isValidTaxRate(parseNumber(draft[t].rateText)));

  function change(type: TaxType, patch: Partial<(typeof draft)[TaxType]>) {
    setDraft((d) => ({ ...d, [type]: { ...d[type], ...patch } }));
    setMessage(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (invalid.length > 0) return;
    const table = Object.fromEntries(
      TAX_TYPES.map((t) => [t, { ratePct: parseNumber(draft[t].rateText), note: draft[t].note.trim(), confirmed: draft[t].confirmed }]),
    ) as TaxRateTable;
    try {
      await updateData((d) => ({ ...d, settings: { ...d.settings, taxRates: table } }), {
        kind: 'settings',
        action: 'update',
        label: '세율 프리셋',
      });
      setMessage({ kind: 'success', text: '세율 프리셋을 저장했습니다.' });
    } catch (e) {
      setMessage({ kind: 'danger', text: toUserMessage(e) });
    }
  }

  function resetDefaults() {
    if (!window.confirm('세율 프리셋을 초기값(예시값 포함)으로 되돌릴까요? 저장 버튼을 눌러야 반영됩니다.')) return;
    setDraft(toDraft(createDefaultTaxRates()));
    setMessage(null);
  }

  return (
    <MainCard title="세율 프리셋 (이자소득세)">
      <p className="text-muted small">
        과세유형별 이자소득세율입니다. 법령·상품·가입 시기에 따라 달라질 수 있으니 가입한 상품 안내문 기준으로 수정하세요.
        확인을 마친 항목은 &quot;확인함&quot;을 체크하면 경고 배지가 사라집니다.
      </p>
      <form onSubmit={onSubmit}>
        <div className="table-responsive">
          <table className="table align-middle mb-0 app-tax-table">
            <thead>
              <tr>
                <th>과세유형</th>
                <th style={{ width: 130 }}>세율(%)</th>
                <th>근거·한도 메모</th>
                <th className="text-center">확인함</th>
              </tr>
            </thead>
            <tbody>
              {TAX_TYPES.map((type) => {
                const row = draft[type];
                const bad = invalid.includes(type);
                return (
                  <tr key={type}>
                    <td>
                      <div className="fw-semibold">{TAX_TYPE_LABELS[type]}</div>
                      <TaxPresetBadge confirmed={row.confirmed} />
                    </td>
                    <td>
                      <input
                        className={`form-control form-control-sm text-end${bad ? ' is-invalid' : ''}`}
                        inputMode="decimal"
                        aria-label={`${TAX_TYPE_LABELS[type]} 세율`}
                        value={row.rateText}
                        onChange={(e) => change(type, { rateText: e.target.value })}
                      />
                      {bad && <div className="invalid-feedback">0~100</div>}
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        aria-label={`${TAX_TYPE_LABELS[type]} 메모`}
                        maxLength={300}
                        value={row.note}
                        onChange={(e) => change(type, { note: e.target.value })}
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        aria-label={`${TAX_TYPE_LABELS[type]} 확인함`}
                        checked={row.confirmed}
                        onChange={(e) => change(type, { confirmed: e.target.checked })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="d-flex gap-2 mt-3 flex-wrap">
          <button type="submit" className="btn btn-primary" disabled={invalid.length > 0}>
            세율 저장
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={resetDefaults}>
            초기값으로
          </button>
        </div>
        <MessageBox message={message} />
      </form>
    </MainCard>
  );
}

function ChangePasswordSection() {
  const { changePassword } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const { meetsMinimum } = assessPassword(next);
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = current.length > 0 && meetsMinimum && next === confirm && !busy;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    if (next === current) {
      setMessage({ kind: 'danger', text: '새 비밀번호가 기존 비밀번호와 같습니다.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setMessage({ kind: 'success', text: '비밀번호를 바꾸고 전체 데이터를 다시 암호화했습니다.' });
    } catch (e) {
      setMessage({ kind: 'danger', text: toUserMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <MainCard title="비밀번호 변경">
      <div className="alert alert-danger py-2 small">
        <strong>비밀번호를 잊으면 복구할 수 없습니다.</strong> 비밀번호는 어디에도 저장되지 않으며, 분실하면 이 브라우저의
        데이터와 해당 비밀번호로 만든 백업 파일 모두 열 수 없습니다.
      </div>
      <form onSubmit={onSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="cp-current">
            현재 비밀번호
          </label>
          <input id="cp-current" className="form-control" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="mb-2">
          <label className="form-label" htmlFor="cp-new">
            새 비밀번호
          </label>
          <input id="cp-new" className="form-control" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <PasswordStrengthMeter password={next} />
        <div className="mb-3">
          <label className="form-label" htmlFor="cp-confirm">
            새 비밀번호 확인
          </label>
          <input
            id="cp-confirm"
            className={`form-control${mismatch ? ' is-invalid' : ''}`}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatch && <div className="invalid-feedback">새 비밀번호가 일치하지 않습니다.</div>}
        </div>
        <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
          {busy ? '다시 암호화하는 중…' : '비밀번호 변경'}
        </button>
        <MessageBox message={message} />
      </form>
      <p className="text-muted small mt-3 mb-0">변경 후에는 이전에 내려받은 백업 파일이 예전 비밀번호로 열린다는 점에 유의하세요.</p>
    </MainCard>
  );
}

function AutoLockSection() {
  const data = useUnlockedData();
  const { setAutoLockMinutes } = useSession();
  const [value, setValue] = useState(String(data.settings.autoLockMinutes));
  const [message, setMessage] = useState<Message>(null);

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= AUTO_LOCK_MIN_MINUTES && parsed <= AUTO_LOCK_MAX_MINUTES;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    try {
      await setAutoLockMinutes(parsed);
      setMessage({ kind: 'success', text: `${parsed}분으로 설정했습니다.` });
    } catch (e) {
      setMessage({ kind: 'danger', text: toUserMessage(e) });
    }
  }

  return (
    <MainCard title="자동 잠금">
      <p className="text-muted small">마우스·키보드 조작이 없으면 설정한 시간 뒤 자동으로 잠기고, 메모리의 키와 데이터를 지웁니다.</p>
      <form onSubmit={onSubmit} className="d-flex align-items-start gap-2 flex-wrap">
        <div>
          <label className="form-label" htmlFor="autolock">
            무조작 시간(분, {AUTO_LOCK_MIN_MINUTES}~{AUTO_LOCK_MAX_MINUTES})
          </label>
          <input
            id="autolock"
            className={`form-control${valid ? '' : ' is-invalid'}`}
            style={{ maxWidth: 160 }}
            type="number"
            inputMode="numeric"
            min={AUTO_LOCK_MIN_MINUTES}
            max={AUTO_LOCK_MAX_MINUTES}
            step={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setMessage(null);
            }}
          />
          {!valid && <div className="invalid-feedback">1~120 사이의 정수를 입력하세요.</div>}
        </div>
        <button type="submit" className="btn btn-primary app-align-input" disabled={!valid || parsed === data.settings.autoLockMinutes}>
          저장
        </button>
      </form>
      <MessageBox message={message} />
    </MainCard>
  );
}

function BackupSection() {
  const data = useUnlockedData();
  const { exportBackup } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reminder = getBackupReminder(data.meta.lastBackupAt, new Date(), data.meta.lastDataChangeAt);

  async function onExport() {
    setBusy(true);
    setError('');
    try {
      await exportBackup();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <MainCard title="백업" id="backup" className="app-scroll-target">
      <p className="text-muted small">
        백업 파일은 현재 비밀번호로 암호화된 상태 그대로 저장됩니다. 파일만으로는 내용을 볼 수 없으며, 복구할 때 그 비밀번호가
        필요합니다. 데이터는 이 브라우저에만 있으므로 정기적으로 백업해 두세요.
      </p>
      <dl className="row mb-3">
        <dt className="col-sm-3 text-muted fw-normal">마지막 백업</dt>
        <dd className="col-sm-9 mb-0">
          {formatDateTime(data.meta.lastBackupAt)}
          {reminder.due && <span className="badge bg-light-warning ms-2">백업 권장</span>}
        </dd>
      </dl>
      <button type="button" className="btn btn-primary" onClick={onExport} disabled={busy}>
        <i className="material-icons-two-tone app-btn-icon me-1" aria-hidden="true">
          get_app
        </i>
        {busy ? '준비하는 중…' : '암호화 백업 내려받기'}
      </button>
      {error && <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div>}

      <hr className="my-4" />
      <h6>백업에서 복구</h6>
      <p className="text-muted small">현재 데이터는 백업 파일 내용으로 대체되고, 비밀번호도 백업 파일의 비밀번호로 바뀝니다.</p>
      <RestoreBackupForm replacesExisting />
    </MainCard>
  );
}
