import { describe, expect, it } from 'vitest';
import { VaultDecryptError } from '../crypto/vault';
import { sampleAssets } from '../data/fixtures';
import { createVault, openVault, persistVault } from '../session/vaultService';
import { MemoryDocStore, RevisionedAdapter, VaultConflictError } from './revisionedAdapter';

const NOW = new Date('2026-01-15T09:00:00.000Z');
const PW = 'virtual-Pass-0001';

describe('RevisionedAdapter (원격 문서 저장)', () => {
  it('서버에는 암호문 봉투와 revision만 저장되고, 다시 열면 같은 데이터다', async () => {
    const server = new MemoryDocStore();
    const adapter = new RevisionedAdapter(server);
    const created = await createVault(adapter, PW, NOW);
    await persistVault(adapter, created.vaultKey, { ...created.data, assets: sampleAssets });

    expect(server.value?.revision).toBe(2);
    const text = JSON.stringify(server.value);
    expect(text).not.toContain('가상');
    expect(text).not.toContain(PW);

    const other = new RevisionedAdapter(server);
    expect((await openVault(other, PW)).data.assets).toEqual(sampleAssets);
    await expect(openVault(other, 'wrong-Pass-0000')).rejects.toBeInstanceOf(VaultDecryptError);
  });

  it('다른 기기가 먼저 저장했으면 오래된 화면의 저장은 거부된다(덮어쓰기 방지)', async () => {
    const server = new MemoryDocStore();
    const pc = new RevisionedAdapter(server);
    const created = await createVault(pc, PW, NOW);

    const phone = new RevisionedAdapter(server);
    const opened = await openVault(phone, PW);
    await persistVault(phone, opened.vaultKey, { ...opened.data, assets: sampleAssets });

    await expect(persistVault(pc, created.vaultKey, created.data)).rejects.toBeInstanceOf(VaultConflictError);
    expect((await openVault(new RevisionedAdapter(server), PW)).data.assets).toEqual(sampleAssets);
  });

  it('다시 읽으면(새로고침) 최신 revision으로 저장할 수 있다', async () => {
    const server = new MemoryDocStore();
    const a = new RevisionedAdapter(server);
    const created = await createVault(a, PW, NOW);
    const b = new RevisionedAdapter(server);
    const opened = await openVault(b, PW);
    await persistVault(b, opened.vaultKey, opened.data);

    await a.load();
    await expect(persistVault(a, created.vaultKey, created.data)).resolves.toBeUndefined();
    expect(server.value?.revision).toBe(3);
  });

  it('clear는 서버 문서를 지운다', async () => {
    const server = new MemoryDocStore();
    const adapter = new RevisionedAdapter(server);
    await createVault(adapter, PW, NOW);
    await adapter.clear();
    expect(server.value).toBeNull();
    expect(await adapter.load()).toBeNull();
  });
});
