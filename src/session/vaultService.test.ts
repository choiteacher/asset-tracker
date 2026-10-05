import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { VaultDecryptError, VaultFormatError } from '../crypto/vault';
import { sampleAssets } from '../data/fixtures';
import { IndexedDbAdapter } from '../storage/indexedDbAdapter';
import {
  changeVaultPassword,
  createVault,
  exportVaultBackup,
  openVault,
  persistVault,
  restoreVaultBackup,
} from './vaultService';

// 고정 기준 시각과 가상 비밀번호만 사용한다.
const NOW = new Date('2026-01-15T09:00:00.000Z');
const LATER = new Date('2026-02-20T12:30:00.000Z');
const PW = 'virtual-Pass-0001';
const PW2 = 'virtual-Pass-0002';

const adapters: IndexedDbAdapter[] = [];
function freshAdapter(): IndexedDbAdapter {
  const adapter = new IndexedDbAdapter('test-db', new IDBFactory());
  adapters.push(adapter);
  return adapter;
}

afterEach(async () => {
  await Promise.all(adapters.splice(0).map((a) => a.close()));
});

describe('IndexedDbAdapter', () => {
  it('최초 실행이면 load()가 null을 돌려준다', async () => {
    expect(await freshAdapter().load()).toBeNull();
  });

  it('clear()로 저장 데이터를 지운다', async () => {
    const adapter = freshAdapter();
    await createVault(adapter, PW, NOW);
    await adapter.clear();
    expect(await adapter.load()).toBeNull();
  });
});

describe('vaultService', () => {
  it('생성 → 자산 저장 → 다시 열기 왕복 시 데이터가 같다', async () => {
    const adapter = freshAdapter();
    const created = await createVault(adapter, PW, NOW);
    const changed = {
      ...created.data,
      settings: { ...created.data.settings, autoLockMinutes: 25 },
      assets: sampleAssets,
    };
    await persistVault(adapter, created.vaultKey, changed);

    const opened = await openVault(adapter, PW);
    expect(opened.data).toEqual(changed);
    expect(opened.data.schemaVersion).toBe(3);
    expect(opened.data.assets).toEqual(sampleAssets);
  });

  it('v1으로 저장된 데이터는 열 때 최신 버전으로 마이그레이션된다', async () => {
    const adapter = freshAdapter();
    const created = await createVault(adapter, PW, NOW);
    const { assets: _assets, ...rest } = created.data;
    const v1 = { ...rest, schemaVersion: 1, settings: { autoLockMinutes: 30 } };
    await persistVault(adapter, created.vaultKey, v1 as unknown as typeof created.data);

    const opened = await openVault(adapter, PW);
    expect(opened.data.schemaVersion).toBe(3);
    expect(opened.data.settings.autoLockMinutes).toBe(30);
    expect(opened.data.assets).toEqual([]);
  });

  it('틀린 비밀번호로는 열리지 않는다', async () => {
    const adapter = freshAdapter();
    await createVault(adapter, PW, NOW);
    await expect(openVault(adapter, PW2)).rejects.toBeInstanceOf(VaultDecryptError);
  });

  it('비밀번호 변경: 기존 비밀번호 확인 후 새 salt로 재암호화된다', async () => {
    const adapter = freshAdapter();
    const created = await createVault(adapter, PW, NOW);
    const before = await adapter.load();

    await changeVaultPassword(adapter, PW, PW2, created.data, LATER);
    const after = await adapter.load();

    expect(after?.kdf.salt).not.toBe(before?.kdf.salt);
    await expect(openVault(adapter, PW)).rejects.toBeInstanceOf(VaultDecryptError);
    const opened = await openVault(adapter, PW2);
    expect(opened.data.meta.lastModifiedAt).toBe(LATER.toISOString());
  });

  it('비밀번호 변경: 기존 비밀번호가 틀리면 거부하고 아무것도 바꾸지 않는다', async () => {
    const adapter = freshAdapter();
    const created = await createVault(adapter, PW, NOW);
    const before = await adapter.load();
    await expect(changeVaultPassword(adapter, 'wrong-Pass-9999', PW2, created.data, LATER)).rejects.toBeInstanceOf(
      VaultDecryptError,
    );
    expect(await adapter.load()).toEqual(before);
  });

  it('백업 내보내기는 마지막 백업 시각을 기록하고, 파일 내용은 암호문뿐이다', async () => {
    const adapter = freshAdapter();
    const created = await createVault(adapter, PW, NOW);
    const withAssets = { ...created.data, assets: sampleAssets };
    const backup = await exportVaultBackup(adapter, created.vaultKey, withAssets, LATER);

    expect(backup.fileName).toMatch(/^asset-tracker-backup-\d{8}-\d{4}\.enc\.json$/);
    expect(backup.data.meta.lastBackupAt).toBe(LATER.toISOString());
    expect(backup.fileText).not.toContain(PW);
    expect(backup.fileText).not.toContain('lastBackupAt');
    expect(backup.fileText).not.toContain('가상');
    expect(backup.fileText).not.toContain('10000000');
    expect((await openVault(adapter, PW)).data.meta.lastBackupAt).toBe(LATER.toISOString());
  });

  it('백업 가져오기: 새 기기(빈 저장소)에서 백업 비밀번호로 복구된다', async () => {
    const source = freshAdapter();
    const created = await createVault(source, PW, NOW);
    const { fileText, data } = await exportVaultBackup(source, created.vaultKey, created.data, LATER);

    const target = freshAdapter();
    const restored = await restoreVaultBackup(target, fileText, PW);
    expect(restored.data).toEqual(data);
    expect((await openVault(target, PW)).data).toEqual(data);
  });

  it('백업 가져오기: 비밀번호가 틀리면 거부하고 기존 데이터를 건드리지 않는다', async () => {
    const source = freshAdapter();
    const created = await createVault(source, PW, NOW);
    const { fileText } = await exportVaultBackup(source, created.vaultKey, created.data, LATER);

    const target = freshAdapter();
    await createVault(target, PW2, NOW);
    const before = await target.load();
    await expect(restoreVaultBackup(target, fileText, PW2)).rejects.toBeInstanceOf(VaultDecryptError);
    expect(await target.load()).toEqual(before);
  });

  it('백업 가져오기: 형식이 다른 파일은 형식 오류로 거부한다', async () => {
    const adapter = freshAdapter();
    await expect(restoreVaultBackup(adapter, '{"hello":"world"}', PW)).rejects.toBeInstanceOf(VaultFormatError);
    await expect(restoreVaultBackup(adapter, 'not json', PW)).rejects.toBeInstanceOf(VaultFormatError);
  });
});
