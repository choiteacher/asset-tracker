import { useRef, useState, type FormEvent } from 'react';
import { LocalImportForm, useLegacyVault } from '../components/LocalImportForm';
import { assessPassword } from '../auth/passwordStrength';
import { AuthShell } from '../components/AuthShell';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { RestoreBackupForm } from '../components/RestoreBackupForm';
import { useSession } from '../session/SessionContext';
import { toUserMessage } from '../utils/errors';

export function SetupPage() {
  const { setup } = useSession();
  const touched = useRef(false);
  const choose = (m: 'new' | 'restore' | 'legacy') => {
    touched.current = true;
    setMode(m);
  };
  const legacy = useLegacyVault();
  const [mode, setMode] = useState<'new' | 'restore' | 'legacy'>('new');
  const shownMode = legacy.found && mode === 'new' && !touched.current ? 'legacy' : mode;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { meetsMinimum } = assessPassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = meetsMinimum && password === confirm && !busy;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await setup(password);
    } catch (e) {
      setError(toUserMessage(e));
      setBusy(false);
    }
  }

  return (
    <AuthShell title="잠금 해제 비밀번호 만들기" subtitle="데이터는 이 비밀번호로 암호화된 상태로만 서버(Firestore)에 저장됩니다.">
      <ul className="nav nav-pills nav-fill mb-4 app-pills" role="tablist">
        <li className="nav-item">
          <button type="button" role="tab" aria-selected={shownMode === 'new'} className={`nav-link w-100${shownMode === 'new' ? ' active' : ''}`} onClick={() => choose('new')}>
            새로 시작
          </button>
        </li>
        <li className="nav-item">
          <button type="button" role="tab" aria-selected={shownMode === 'restore'} className={`nav-link w-100${shownMode === 'restore' ? ' active' : ''}`} onClick={() => choose('restore')}>
            백업에서 복구
          </button>
        </li>
        {legacy.found && (
          <li className="nav-item">
            <button type="button" role="tab" aria-selected={shownMode === 'legacy'} className={`nav-link w-100${shownMode === 'legacy' ? ' active' : ''}`} onClick={() => choose('legacy')}>
              기존 데이터
            </button>
          </li>
        )}
      </ul>

      {shownMode === 'legacy' ? (
        <LocalImportForm />
      ) : shownMode === 'new' ? (
        <form onSubmit={onSubmit} className="text-start">
          <div className="mb-2">
            <label className="form-label" htmlFor="setup-pw">
              비밀번호
            </label>
            <input id="setup-pw" className="form-control" type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <PasswordStrengthMeter password={password} />
          <div className="mb-3">
            <label className="form-label" htmlFor="setup-pw2">
              비밀번호 확인
            </label>
            <input
              id="setup-pw2"
              className={`form-control${mismatch ? ' is-invalid' : ''}`}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {mismatch && <div className="invalid-feedback">비밀번호가 일치하지 않습니다.</div>}
          </div>
          {error && (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          )}
          <div className="alert alert-danger py-2 small">
            로그인 비밀번호와 다른 비밀번호를 쓰세요. 이 비밀번호를 잊으면 데이터를 복구할 수 없습니다(어디에도 저장되지 않음).
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={!canSubmit}>
            {busy ? '암호화 키 만드는 중…' : '비밀번호 설정하고 시작'}
          </button>
        </form>
      ) : (
        <RestoreBackupForm replacesExisting={false} />
      )}
    </AuthShell>
  );
}
