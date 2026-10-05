// 원격 문서 1개에 암호문 봉투를 저장하는 StorageAdapter.
// 저장할 때마다 revision(버전 번호)을 1씩 올리고, 내가 마지막으로 읽은 revision과 서버 값이 다르면 저장을 거부한다.
// → 다른 기기(탭)에서 먼저 저장한 최신 데이터를 오래된 화면이 덮어쓰지 못하게 한다.

import { assertVaultEnvelope, type VaultEnvelope } from '../crypto/vault';
import { parseBackup, serializeBackup } from './backupFile';
import type { StorageAdapter } from './StorageAdapter';

export interface StoredVault {
  envelope: VaultEnvelope;
  revision: number;
}

/** 원격 저장소(예: Firestore 문서 하나)에 대한 최소 기능. */
export interface VaultDocStore {
  read(): Promise<StoredVault | null>;
  /** 서버의 현재 revision이 expectedRevision일 때만 쓰고 새 revision을 돌려준다. 아니면 VaultConflictError. */
  write(envelope: VaultEnvelope, expectedRevision: number): Promise<number>;
  remove(): Promise<void>;
}

export class VaultConflictError extends Error {
  constructor() {
    super('다른 기기나 탭에서 먼저 저장한 내용이 있습니다. 화면을 새로고침한 뒤 다시 시도하세요.');
    this.name = 'VaultConflictError';
  }
}

export class RevisionedAdapter implements StorageAdapter {
  /** 마지막으로 읽거나 쓴 revision. 아직 읽지 않았으면 null. */
  private revision: number | null = null;

  constructor(private readonly store: VaultDocStore) {}

  async load(): Promise<VaultEnvelope | null> {
    const stored = await this.store.read();
    this.revision = stored?.revision ?? 0;
    if (!stored) return null;
    assertVaultEnvelope(stored.envelope);
    return stored.envelope;
  }

  async save(envelope: VaultEnvelope): Promise<void> {
    assertVaultEnvelope(envelope);
    if (this.revision === null) await this.load();
    this.revision = await this.store.write(envelope, this.revision ?? 0);
  }

  async export(): Promise<string> {
    const envelope = await this.load();
    if (!envelope) throw new Error('내보낼 데이터가 없습니다.');
    return serializeBackup(envelope);
  }

  async import(fileText: string): Promise<VaultEnvelope> {
    return parseBackup(fileText);
  }

  async clear(): Promise<void> {
    await this.store.remove();
    this.revision = 0;
  }
}

/** 테스트용 메모리 저장소(서버 역할). */
export class MemoryDocStore implements VaultDocStore {
  value: StoredVault | null = null;

  async read(): Promise<StoredVault | null> {
    return this.value ? structuredClone(this.value) : null;
  }

  async write(envelope: VaultEnvelope, expectedRevision: number): Promise<number> {
    const current = this.value?.revision ?? 0;
    if (current !== expectedRevision) throw new VaultConflictError();
    this.value = { envelope: structuredClone(envelope), revision: current + 1 };
    return current + 1;
  }

  async remove(): Promise<void> {
    this.value = null;
  }
}
