import { assertVaultEnvelope, VaultFormatError, type VaultEnvelope } from '../crypto/vault';

// 백업 파일은 암호문 봉투 그대로의 JSON이다. 어떤 어댑터든 같은 형식을 쓴다.

export function serializeBackup(envelope: VaultEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

export function parseBackup(fileText: string): VaultEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new VaultFormatError();
  }
  assertVaultEnvelope(parsed);
  return parsed;
}

/** 예: asset-tracker-backup-20261005-1430.enc.json (.gitignore 패턴과 일치) */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `asset-tracker-backup-${stamp}.enc.json`;
}
