export const BACKUP_REMINDER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface BackupReminder {
  due: boolean;
  /** 마지막 백업 후 경과 일수(내림). 백업한 적 없으면 null. */
  daysSince: number | null;
  /** 마지막 백업 이후 데이터를 바꿨는지. */
  changedSinceBackup: boolean;
  reason: 'never' | 'old' | 'changed' | null;
}

/**
 * 백업 권장 여부. 한 번도 백업하지 않았거나, 30일 이상 지났거나, 백업 후 데이터를 바꿨으면 권장한다.
 * lastDataChangeAt: 사용자가 데이터를 마지막으로 바꾼 시각(스냅샷 자동 기록 제외).
 */
export function getBackupReminder(lastBackupAt: string | null, now: Date, lastDataChangeAt: string | null = null): BackupReminder {
  const last = lastBackupAt ? Date.parse(lastBackupAt) : Number.NaN;
  if (Number.isNaN(last)) return { due: true, daysSince: null, changedSinceBackup: lastDataChangeAt !== null, reason: 'never' };
  const daysSince = Math.max(0, Math.floor((now.getTime() - last) / DAY_MS));
  const changed = lastDataChangeAt !== null && Date.parse(lastDataChangeAt) > last;
  if (daysSince >= BACKUP_REMINDER_DAYS) return { due: true, daysSince, changedSinceBackup: changed, reason: 'old' };
  if (changed) return { due: true, daysSince, changedSinceBackup: true, reason: 'changed' };
  return { due: false, daysSince, changedSinceBackup: false, reason: null };
}
