import type { VaultEnvelope } from '../crypto/vault';
import { assertVaultEnvelope } from '../crypto/vault';
import { parseBackup, serializeBackup } from './backupFile';
import type { StorageAdapter } from './StorageAdapter';

const DB_VERSION = 1;
const STORE = 'vault';
const RECORD_KEY = 'main';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('브라우저 저장소 작업에 실패했습니다.'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('브라우저 저장소 작업에 실패했습니다.'));
    tx.onabort = () => reject(new Error('브라우저 저장소 작업이 취소되었습니다.'));
  });
}

export class IndexedDbAdapter implements StorageAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly dbName = 'asset-tracker',
    private readonly factory: IDBFactory = indexedDB,
  ) {}

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = this.factory.open(this.dbName, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          this.dbPromise = null;
          reject(new Error('브라우저 저장소를 열 수 없습니다.'));
        };
      });
    }
    return this.dbPromise;
  }

  async load(): Promise<VaultEnvelope | null> {
    const db = await this.open();
    const tx = db.transaction(STORE, 'readonly');
    const value = await requestToPromise(tx.objectStore(STORE).get(RECORD_KEY));
    if (value === undefined) return null;
    assertVaultEnvelope(value);
    return value;
  }

  async save(envelope: VaultEnvelope): Promise<void> {
    assertVaultEnvelope(envelope);
    const db = await this.open();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(envelope, RECORD_KEY);
    await transactionDone(tx);
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
    const db = await this.open();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(RECORD_KEY);
    await transactionDone(tx);
  }

  /** 테스트·정리용. */
  async close(): Promise<void> {
    if (this.dbPromise) (await this.dbPromise).close();
    this.dbPromise = null;
  }
}
