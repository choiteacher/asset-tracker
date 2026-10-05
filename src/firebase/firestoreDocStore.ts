// Firestore 문서 vaults/{uid} 하나에 암호문 봉투를 저장한다.
// 문서 구조: { envelope: 암호문 봉투, revision: 정수, updatedAt: 서버 시각 } — 평문 데이터는 없다.

import { deleteDoc, doc, getDoc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore/lite';
import { assertVaultEnvelope, type VaultEnvelope } from '../crypto/vault';
import { VaultConflictError, type StoredVault, type VaultDocStore } from '../storage/revisionedAdapter';

export const VAULT_COLLECTION = 'vaults';

export class FirestoreDocStore implements VaultDocStore {
  constructor(
    private readonly db: Firestore,
    private readonly uid: string,
  ) {}

  private ref() {
    return doc(this.db, VAULT_COLLECTION, this.uid);
  }

  async read(): Promise<StoredVault | null> {
    const snap = await getDoc(this.ref());
    if (!snap.exists()) return null;
    const data = snap.data();
    assertVaultEnvelope(data.envelope);
    return { envelope: data.envelope, revision: typeof data.revision === 'number' ? data.revision : 0 };
  }

  async write(envelope: VaultEnvelope, expectedRevision: number): Promise<number> {
    const ref = this.ref();
    return runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists() && typeof snap.data().revision === 'number' ? (snap.data().revision as number) : 0;
      if (current !== expectedRevision) throw new VaultConflictError();
      const next = current + 1;
      // 보안 규칙이 같은 조건(revision = 이전 + 1, updatedAt = 서버 시각, 필드 제한)을 서버에서 다시 검사한다.
      tx.set(ref, { envelope: { ...envelope }, revision: next, updatedAt: serverTimestamp() });
      return next;
    });
  }

  async remove(): Promise<void> {
    await deleteDoc(this.ref());
  }
}
