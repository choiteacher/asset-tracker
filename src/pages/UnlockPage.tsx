import { useEffect, useState, type FormEvent } from 'react';
import {
  EMPTY_THROTTLE,
  loadThrottle,
  recordFailure,
  remainingWaitMs,
  storeThrottle,
  type ThrottleState,
} from '../auth/unlockThrottle';
import { VaultDecryptError } from '../crypto/vault';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../firebase/AuthContext';
import { useSession } from '../session/SessionContext';
import { toUserMessage } from '../utils/errors';

const RESET_WORD = '초기화';

export function UnlockPage() {
  const { unlock, resetAll } = useSession();
  const { signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [throttle, setThrottle] = useState<ThrottleState>(() => loadThrottle());
  const [now, setNow] = useState(Date.now);
  const [showReset, setShowReset] = useState(false);
  const [resetText, setResetText] = useState('');

  const waitMs = remainingWaitMs(throttle, now);
  const waiting = waitMs > 0;

  // 대기 중일 때만 남은 시간을 갱신한다.
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [waiting]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password || busy || remainingWaitMs(throttle, Date.now()) > 0) return;
    setBusy(true);
    setError('');
    try {
      await unlock(password);
      storeThrottle(EMPTY_THROTTLE);
    } catch (e) {
      if (e instanceof VaultDecryptError) {
        const next = recordFailure(throttle, Date.now());
        storeThrottle(next);
        setThrottle(next);
        setNow(Date.now());
      }
      setError(toUserMessage(e));
      setPassword('');
      setBusy(false);
    }
  }

  async function onReset() {
    if (resetText !== RESET_WORD) return;
    if (!window.confirm('서버에 저장된 모든 자산 데이터가 영구 삭제됩니다. 정말 초기화할까요?')) return;
    await resetAll();
    storeThrottle(EMPTY_THROTTLE);
  }

  return (
    <AuthShell title="잠금 해제" subtitle="잠금 해제 비밀번호를 입력하면 서버에서 받은 암호문을 이 브라우저 안에서만 풉니다.">
      <form onSubmit={onSubmit} className="text-start">
        <div className="input-group mb-3">
          <span className="input-group-text" aria-hidden="true">
            <i className="material-icons-two-tone">lock</i>
          </span>
          <input
            className="form-control"
            type="password"
            aria-label="잠금 해제 비밀번호"
            placeholder="잠금 해제 비밀번호"
            autoComplete="current-password"
            autoFocus
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <div className="alert alert-danger py-2" role="alert">
            {error}
          </div>
        )}
        {waiting && (
          <div className="alert alert-warning py-2" aria-live="polite">
            여러 번 틀려서 {Math.ceil(waitMs / 1000)}초 뒤에 다시 시도할 수 있습니다.
          </div>
        )}
        <button type="submit" className="btn btn-primary w-100" disabled={!password || busy || waiting}>
          {busy ? '확인하는 중…' : '잠금 해제'}
        </button>
      </form>

      <div className="mt-4 pt-3 border-top text-start">
        {!showReset ? (
          <div className="d-flex justify-content-between flex-wrap gap-2">
            <button type="button" className="btn btn-link p-0 text-muted" onClick={() => setShowReset(true)}>
              잠금 해제 비밀번호를 잊으셨나요?
            </button>
            <button type="button" className="btn btn-link p-0 text-muted" onClick={() => void signOut()}>
              로그아웃
            </button>
          </div>
        ) : (
          <div>
            <p className="small">
              비밀번호는 어디에도 저장되지 않으므로 <strong>찾거나 복구할 수 없습니다.</strong> 데이터를 모두 지우고 새로
              시작한 뒤, 기억하는 비밀번호의 백업 파일이 있다면 그것으로 복구할 수 있습니다.
            </p>
            <label className="form-label small" htmlFor="reset-word">
              계속하려면 &quot;{RESET_WORD}&quot;를 입력하세요
            </label>
            <input id="reset-word" className="form-control mb-2" value={resetText} onChange={(e) => setResetText(e.target.value)} />
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-danger" disabled={resetText !== RESET_WORD} onClick={onReset}>
                모든 데이터 삭제
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setShowReset(false)}>
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
