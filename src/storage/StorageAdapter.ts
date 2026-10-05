import type { VaultEnvelope } from '../crypto/vault';

/**
 * 암호문(VaultEnvelope)을 보관하는 저장소 추상화.
 * 어댑터는 평문을 절대 다루지 않는다. 암·복호화는 세션 계층(crypto/vault)에서만 한다.
 */
export interface StorageAdapter {
  /** 저장된 암호문. 최초 실행이면 null. */
  load(): Promise<VaultEnvelope | null>;
  /** 암호문 전체를 덮어쓴다. */
  save(envelope: VaultEnvelope): Promise<void>;
  /** 현재 저장된 암호문을 백업 파일 내용(JSON 텍스트)으로 만든다. */
  export(): Promise<string>;
  /**
   * 백업 파일 내용을 파싱·형식 검증해 암호문으로 돌려준다.
   * 비밀번호 검증 전이므로 여기서는 저장하지 않는다. 복호화에 성공한 뒤 호출 측이 save 한다.
   */
  import(fileText: string): Promise<VaultEnvelope>;
  /** 저장된 데이터를 모두 지운다(비밀번호 분실 시 초기화). */
  clear(): Promise<void>;
}
