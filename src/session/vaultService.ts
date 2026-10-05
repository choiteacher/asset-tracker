// 저장소 어댑터 + 암호화 모듈을 묶은 작업 단위. React와 무관한 순수 비동기 함수라 테스트에서 그대로 쓴다.

import {
  decryptWithKey,
  decryptWithPassword,
  deriveVaultKey,
  encryptJson,
  VaultDecryptError,
  type VaultKey,
} from '../crypto/vault';
import { createEmptyAppData, migrateAppData, type AppData } from '../data/schema';
import { backupFileName } from '../storage/backupFile';
import type { StorageAdapter } from '../storage/StorageAdapter';

export interface OpenVault {
  vaultKey: VaultKey;
  data: AppData;
}

export async function createVault(adapter: StorageAdapter, password: string, now: Date): Promise<OpenVault> {
  const vaultKey = await deriveVaultKey(password);
  const data = createEmptyAppData(now);
  await adapter.save(await encryptJson(vaultKey, data));
  return { vaultKey, data };
}

export async function openVault(adapter: StorageAdapter, password: string): Promise<OpenVault> {
  const envelope = await adapter.load();
  if (!envelope) throw new VaultDecryptError();
  const { value, vaultKey } = await decryptWithPassword(password, envelope);
  return { vaultKey, data: migrateAppData(value) };
}

/** 저장할 때마다 encryptJson이 새 IV를 만든다. */
export async function persistVault(adapter: StorageAdapter, vaultKey: VaultKey, data: AppData): Promise<void> {
  await adapter.save(await encryptJson(vaultKey, data));
}

/**
 * 기존 비밀번호를 저장된 암호문으로 다시 검증한 뒤, 새 salt로 키를 유도해 전체를 재암호화한다.
 * 기존 비밀번호가 틀리면 VaultDecryptError.
 */
export async function changeVaultPassword(
  adapter: StorageAdapter,
  currentPassword: string,
  newPassword: string,
  data: AppData,
  now: Date,
): Promise<OpenVault> {
  const envelope = await adapter.load();
  if (!envelope) throw new VaultDecryptError();
  await decryptWithPassword(currentPassword, envelope);
  const vaultKey = await deriveVaultKey(newPassword);
  const next: AppData = { ...data, meta: { ...data.meta, lastModifiedAt: now.toISOString() } };
  await persistVault(adapter, vaultKey, next);
  // 저장 결과가 새 키로 열리는지 확인한다.
  const saved = await adapter.load();
  if (!saved) throw new VaultDecryptError();
  await decryptWithKey(vaultKey, saved);
  return { vaultKey, data: next };
}

/** 마지막 백업 시각을 기록해 저장한 뒤, 그 암호문을 백업 파일 내용으로 돌려준다. */
export async function exportVaultBackup(
  adapter: StorageAdapter,
  vaultKey: VaultKey,
  data: AppData,
  now: Date,
): Promise<{ fileName: string; fileText: string; data: AppData }> {
  const next: AppData = { ...data, meta: { ...data.meta, lastBackupAt: now.toISOString() } };
  await persistVault(adapter, vaultKey, next);
  return { fileName: backupFileName(now), fileText: await adapter.export(), data: next };
}

/**
 * 백업 파일을 그 백업의 비밀번호로 복호화해 검증한 뒤 현재 데이터를 대체한다.
 * 이후 잠금 해제 비밀번호는 백업 파일의 비밀번호가 된다.
 */
export async function restoreVaultBackup(
  adapter: StorageAdapter,
  fileText: string,
  password: string,
): Promise<OpenVault> {
  const envelope = await adapter.import(fileText);
  const { value, vaultKey } = await decryptWithPassword(password, envelope);
  const data = migrateAppData(value);
  await persistVault(adapter, vaultKey, data);
  return { vaultKey, data };
}
