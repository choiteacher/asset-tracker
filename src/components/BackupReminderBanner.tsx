import { Link } from 'react-router';
import { BACKUP_REMINDER_DAYS, getBackupReminder } from '../data/backupReminder';
import { Icon } from './Icon';

export function BackupReminderBanner({ lastBackupAt, lastDataChangeAt }: { lastBackupAt: string | null; lastDataChangeAt: string | null }) {
  const { due, daysSince, reason } = getBackupReminder(lastBackupAt, new Date(), lastDataChangeAt);
  if (!due) return null;
  const message =
    reason === 'never'
      ? '아직 백업한 적이 없습니다.'
      : reason === 'old'
        ? `마지막 백업 후 ${daysSince}일이 지났습니다(권장 주기 ${BACKUP_REMINDER_DAYS}일).`
        : '마지막 백업 이후 데이터가 바뀌었습니다.';
  return (
    <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2" role="status">
      <span className="d-flex align-items-center gap-2">
        <Icon name="backup" />
        <span>
          {message} 브라우저 데이터가 지워지면 복구할 수 없으니 암호화 백업을 내려받아 두세요.
        </span>
      </span>
      <Link to="/settings#backup" className="btn btn-sm btn-warning">
        백업하기
      </Link>
    </div>
  );
}
