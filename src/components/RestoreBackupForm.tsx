import { useId, useState, type FormEvent } from 'react';
import { useSession } from '../session/SessionContext';
import { toUserMessage } from '../utils/errors';

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

/** 암호화 백업 파일 + 그 백업의 비밀번호로 복구한다. 복호화에 성공해야만 현재 데이터를 대체한다. */
export function RestoreBackupForm({ replacesExisting }: { replacesExisting: boolean }) {
  const { restoreBackup } = useSession();
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError('파일이 너무 큽니다. 자산 트래커 백업 파일이 맞는지 확인하세요.');
      return;
    }
    if (
      replacesExisting &&
      !window.confirm('현재 데이터가 백업 파일의 내용으로 모두 대체됩니다. 이후 비밀번호도 백업 파일의 비밀번호가 됩니다. 계속할까요?')
    ) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await restoreBackup(await file.text(), password);
      setPassword('');
      setDone(true);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="text-start">
      <div className="mb-3">
        <label className="form-label" htmlFor={`${id}-file`}>
          백업 파일 (.enc.json)
        </label>
        <input
          id={`${id}-file`}
          className="form-control"
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setDone(false);
            setError('');
          }}
        />
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor={`${id}-pw`}>
          백업할 때 쓰던 비밀번호
        </label>
        <input
          id={`${id}-pw`}
          className="form-control"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <div className="alert alert-danger py-2" role="alert">
          {error}
        </div>
      )}
      {done && <div className="alert alert-success py-2">백업을 불러왔습니다.</div>}
      <button type="submit" className="btn btn-primary" disabled={!file || !password || busy}>
        {busy ? '복호화하는 중…' : '백업에서 복구'}
      </button>
    </form>
  );
}
