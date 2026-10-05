import { useEffect, useState, type FormEvent } from 'react';
import {
  EMPTY_THROTTLE,
  loadThrottle,
  LOGIN_THROTTLE_KEY,
  recordFailure,
  remainingWaitMs,
  storeThrottle,
  type ThrottleState,
} from '../auth/unlockThrottle';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../firebase/AuthContext';
import { toUserMessage } from '../utils/errors';

/** 관리자 로그인. 회원가입·비밀번호 찾기 링크는 두지 않는다(계정 관리는 Firebase 콘솔에서). */
export function SignInPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [throttle, setThrottle] = useState<ThrottleState>(() => loadThrottle(LOGIN_THROTTLE_KEY));
  const [now, setNow] = useState(Date.now);
  const waitMs = remainingWaitMs(throttle, now);
  const waiting = waitMs > 0;

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [waiting]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email || !password || busy || remainingWaitMs(throttle, Date.now()) > 0) return;
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      storeThrottle(EMPTY_THROTTLE, LOGIN_THROTTLE_KEY);
    } catch (e) {
      const next = recordFailure(throttle, Date.now());
      storeThrottle(next, LOGIN_THROTTLE_KEY);
      setThrottle(next);
      setNow(Date.now());
      setError(toUserMessage(e));
      setPassword('');
      setBusy(false);
    }
  }

  return (
    <AuthShell title="관리자 로그인" subtitle="등록된 관리자 계정으로만 이용할 수 있습니다.">
      <form onSubmit={onSubmit} className="text-start">
        <div className="mb-3">
          <label className="form-label" htmlFor="login-email">
            이메일
          </label>
          <input id="login-email" className="form-control" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="login-pw">
            로그인 비밀번호
          </label>
          <input id="login-pw" className="form-control" type="password" autoComplete="current-password" value={password} disabled={busy} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && (
          <div className="alert alert-danger py-2" role="alert">
            {error}
          </div>
        )}
        {waiting && (
          <div className="alert alert-warning py-2" aria-live="polite">
            여러 번 실패해서 {Math.ceil(waitMs / 1000)}초 뒤에 다시 시도할 수 있습니다.
          </div>
        )}
        <button type="submit" className="btn btn-primary w-100" disabled={!email || !password || busy || waiting}>
          {busy ? '확인하는 중…' : '로그인'}
        </button>
      </form>
      <p className="text-muted small mt-4 mb-0">
        로그인 후에는 데이터를 여는 <strong>잠금 해제 비밀번호</strong>를 한 번 더 입력합니다. 데이터는 이 비밀번호로 암호화되어 있어 서버에서도 내용을 볼 수 없습니다.
      </p>
    </AuthShell>
  );
}
