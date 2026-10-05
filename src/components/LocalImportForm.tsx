import { useEffect, useState, type FormEvent } from 'react';
import { serializeBackup } from '../storage/backupFile';
import { IndexedDbAdapter } from '../storage/indexedDbAdapter';
import { useSession } from '../session/SessionContext';
import { toUserMessage } from '../utils/errors';

/** 이전 버전(브라우저 IndexedDB 저장)에서 쓰던 데이터를 찾아 Firestore로 옮기고, 성공하면 브라우저 사본을 지운다. */
export function useLegacyVault(): { found: boolean; checked: boolean } {
  const [state, setState] = useState({ found: false, checked: false });
  useEffect(() => {
    if (typeof indexedDB === 'undefined') {
      setState({ found: false, checked: true });
      return;
    }
    const local = new IndexedDbAdapter();
    local
      .load()
      .then((env) => setState({ found: env !== null, checked: true }))
      .catch(() => setState({ found: false, checked: true }))
      .finally(() => void local.close());
  }, []);
  return state;
}

export function LocalImportForm() {
  const { restoreBackup } = useSession();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    const local = new IndexedDbAdapter();
    try {
      const envelope = await local.load();
      if (!envelope) throw new Error('none');
      await restoreBackup(serializeBackup(envelope), password);
      // 서버 저장이 끝났으므로 브라우저에 남은 사본은 지운다(Firestore만 사용).
      await local.clear();
    } catch (e) {
      setError(toUserMessage(e));
      setBusy(false);
    } finally {
      await local.close();
    }
  }

  return (
    <form onSubmit={onSubmit} className="text-start">
      <div className="alert alert-info py-2 small">
        이 브라우저에 이전 버전에서 저장한 데이터가 있습니다. 그때 쓰던 <strong>잠금 해제 비밀번호</strong>를 입력하면 암호화된 상태 그대로 서버로 옮기고, 브라우저 사본은 지웁니다.
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="legacy-pw">
          이전 잠금 해제 비밀번호
        </label>
        <input id="legacy-pw" className="form-control" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && (
        <div className="alert alert-danger py-2" role="alert">
          {error}
        </div>
      )}
      <button type="submit" className="btn btn-primary w-100" disabled={!password || busy}>
        {busy ? '옮기는 중…' : '기존 데이터를 서버로 옮기기'}
      </button>
    </form>
  );
}
